/**
 * packages/web/src/server/personaResolver.ts
 *
 * 根拠: ADR-0005 / DevOps:SPEC-INT-054 / PrjOps:REQ-041。
 * validated Entra stable subject と request-time active assignment の積だけを persona にする。
 */
import { isValidId, type PgQueryable } from "@aiops/shared";
import type { Profile as DevopsProfile, DevOpsVisibilityContext } from "@aiops/devops";
import type { Profile as PrjopsProfile, ProjectVisibilityContext } from "@aiops/prjops";
import type { EntraCaller } from "./entraClaims";

export type EntraSubject = EntraCaller["subject"];
export type PersonaScope = { mode: "project"; projectId: string } | { mode: "global"; projectId: null };

type PersonaBase = { scope: PersonaScope };
export type ResolvedPersona =
  | (PersonaBase & { domain: "prjops"; profile: PrjopsProfile; visibility: ProjectVisibilityContext })
  | (PersonaBase & { domain: "investor"; profile: "investor"; visibility: ProjectVisibilityContext })
  | (PersonaBase & { domain: "devops"; profile: DevopsProfile; visibility: DevOpsVisibilityContext });

export interface PersonaResolver {
  resolveBySubject(subject: EntraSubject): Promise<ResolvedPersona[]>;
}

const DEVOPS_PROFILES = new Set<DevopsProfile>(["PRF-M", "PRF-L", "PRF-G"]);
const PROFILE_ORDER = new Map<string, number>([
  ["PRF-01", 0],
  ["PRF-M", 1],
  ["PRF-02", 2],
  ["PRF-L", 3],
  ["PRF-03", 4],
  ["PRF-G", 5],
  ["PRF-04", 6],
  ["PRF-05", 7],
  ["investor", 7],
]);

function sameSubject(left: EntraSubject, right: EntraSubject): boolean {
  return left.tenantId === right.tenantId && left.objectId === right.objectId;
}

function asciiCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function comparePersonas(left: ResolvedPersona, right: ResolvedPersona): number {
  const profile = (PROFILE_ORDER.get(left.profile) ?? 99) - (PROFILE_ORDER.get(right.profile) ?? 99);
  if (profile !== 0) return profile;
  const domain = asciiCompare(left.domain, right.domain);
  if (domain !== 0) return domain;
  if (left.scope.mode !== right.scope.mode) return left.scope.mode === "project" ? -1 : 1;
  return left.scope.mode === "project" && right.scope.mode === "project"
    ? asciiCompare(left.scope.projectId, right.scope.projectId)
    : 0;
}

/** recipients を stable subject と active/applied 条件で毎リクエスト照会する。 */
export class DevopsPersonaSource {
  constructor(private readonly db: PgQueryable) {}

  async resolveBySubject(subject: EntraSubject): Promise<ResolvedPersona[]> {
    const result = await this.db.query(
      `SELECT user_id, profile, projects, scope_mode, active, backfill_state
         FROM recipients
        WHERE entra_tenant_id = $1
          AND entra_object_id = $2
          AND active = TRUE
          AND backfill_state = 'applied'`,
      [subject.tenantId, subject.objectId],
    );
    if (result.rows.length !== 1) return [];

    const row = result.rows[0]!;
    if (row["active"] !== true || row["backfill_state"] !== "applied") return [];
    if (typeof row["profile"] !== "string" || !DEVOPS_PROFILES.has(row["profile"] as DevopsProfile)) return [];
    if (
      !Array.isArray(row["projects"]) ||
      row["projects"].some((id) => typeof id !== "string" || !isValidId("project", id))
    ) {
      return [];
    }
    const projects = row["projects"] as string[];
    if (new Set(projects).size !== projects.length) return [];

    const profile = row["profile"] as DevopsProfile;
    const userId = typeof row["user_id"] === "string" ? row["user_id"] : "";
    if (!userId) return [];
    if (row["scope_mode"] === "global") {
      if (profile !== "PRF-G" || projects.length !== 0) return [];
      return [
        {
          domain: "devops",
          profile,
          scope: { mode: "global", projectId: null },
          visibility: { recipientUserId: userId, recipientAssignedProjectIds: [], scopeMode: "global" },
        },
      ];
    }
    if (row["scope_mode"] !== "project" || projects.length === 0) return [];
    return [...projects].sort(asciiCompare).map((projectId) => ({
      domain: "devops" as const,
      profile,
      scope: { mode: "project" as const, projectId },
      visibility: { recipientUserId: userId, recipientAssignedProjectIds: [projectId], scopeMode: "project" },
    }));
  }
}

/** PrjOps master の active assignment 1件。email は配送属性であり認可入力に含めない。 */
export interface StakeholderRecord {
  stakeholderId: string;
  subject: EntraSubject;
  active: boolean;
  assignmentActive: boolean;
  domain: "prjops" | "investor";
  profile: PrjopsProfile | "investor";
  scope: PersonaScope;
}

export interface StakeholderMasterProvider {
  findBySubject(subject: EntraSubject): Promise<StakeholderRecord[]>;
}

/** 開発/テスト用。production composition では YAML provider に差し替える。 */
export class InMemoryStakeholderMasterProvider implements StakeholderMasterProvider {
  constructor(private readonly records: StakeholderRecord[] = []) {}

  async findBySubject(subject: EntraSubject): Promise<StakeholderRecord[]> {
    return this.records.filter((record) => sameSubject(record.subject, subject));
  }
}

function prjopsVisibility(record: StakeholderRecord): ProjectVisibilityContext | undefined {
  if (!record.active || !record.assignmentActive) return undefined;
  if (record.scope.mode === "global") {
    if (record.domain !== "prjops" || record.profile !== "PRF-04") return undefined;
    return {
      recipientStakeholderId: record.stakeholderId,
      recipientManagedProjectIds: [],
      recipientAssignedProjectIds: [],
      recipientParticipatingProjectIds: [],
      investedProjectIds: [],
      scopeMode: "global",
    };
  }
  if (!isValidId("project", record.scope.projectId)) return undefined;
  const projectId = record.scope.projectId;
  return {
    recipientStakeholderId: record.stakeholderId,
    recipientManagedProjectIds: record.profile === "PRF-03" || record.profile === "PRF-04" ? [projectId] : [],
    recipientAssignedProjectIds: record.profile === "PRF-02" ? [projectId] : [],
    recipientParticipatingProjectIds: record.profile === "PRF-01" ? [projectId] : [],
    investedProjectIds: record.profile === "PRF-05" || record.profile === "investor" ? [projectId] : [],
    scopeMode: "project",
  };
}

export class PrjopsPersonaSource {
  constructor(private readonly provider: StakeholderMasterProvider) {}

  async resolveBySubject(subject: EntraSubject): Promise<ResolvedPersona[]> {
    const records = await this.provider.findBySubject(subject);
    const personas: ResolvedPersona[] = [];
    for (const record of records) {
      const visibility = prjopsVisibility(record);
      if (!visibility) continue;
      if (record.domain === "investor") {
        if (record.profile !== "investor" && record.profile !== "PRF-05") continue;
        personas.push({ domain: "investor", profile: "investor", scope: record.scope, visibility });
      } else if (record.profile !== "investor" && record.profile !== "PRF-05") {
        personas.push({ domain: "prjops", profile: record.profile, scope: record.scope, visibility });
      } else if (record.profile === "PRF-05") {
        personas.push({ domain: "investor", profile: "investor", scope: record.scope, visibility });
      }
    }
    return personas;
  }
}

export class CompositePersonaResolver implements PersonaResolver {
  constructor(
    private readonly devopsSource: DevopsPersonaSource,
    private readonly prjopsSource: PrjopsPersonaSource,
  ) {}

  async resolveBySubject(subject: EntraSubject): Promise<ResolvedPersona[]> {
    const [devopsPersonas, prjopsPersonas] = await Promise.all([
      this.devopsSource.resolveBySubject(subject),
      this.prjopsSource.resolveBySubject(subject),
    ]);
    return [...devopsPersonas, ...prjopsPersonas].sort(comparePersonas);
  }
}
