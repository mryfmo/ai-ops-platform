/**
 * packages/prjops/src/data/yamlStakeholderMasterProvider.ts
 *
 * 根拠: PrjOps:REQ-002, PrjOps:SPEC-INT-010, PrjOps:SPEC-INT-022（関係者マスタ）、
 * PrjOps:AC-002-1（複数プロジェクト・複数立場）。PrjOps:SPEC-INT-010のprjops-data論理境界をDIで維持するが、
 * productionのpinned SHA取得とrepository権限の環境証跡は後続のprovider/ENV gateで検証する。
 */
import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { isValidId } from "@aiops/shared/ids.js";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import type { Profile } from "../lib/reportJobStateMachine.js";

export interface EntraSubject {
  tenantId: string;
  objectId: string;
}

export interface StakeholderRecord {
  stakeholderId: string;
  subject: EntraSubject;
  active: boolean;
  assignmentActive: boolean;
  domain: "prjops" | "investor";
  profile: Profile | "investor";
  scope: { mode: "project"; projectId: string } | { mode: "global"; projectId: null };
}

export interface StakeholderMasterProvider {
  findBySubject(subject: EntraSubject): Promise<StakeholderRecord[]>;
}

interface FileStat {
  isFile(): boolean;
}

export interface StakeholderMasterFileHandle {
  stat(): Promise<FileStat>;
  readFile(): Promise<string>;
  close(): Promise<void>;
}

export interface StakeholderMasterDirectoryStat {
  dev: number | bigint;
  ino: number | bigint;
  isDirectory(): boolean;
}

export interface StakeholderMasterFileSystem {
  realpath(path: string): Promise<string>;
  lstat(path: string): Promise<StakeholderMasterDirectoryStat>;
  readdir(directory: string): Promise<string[]>;
  open(path: string, flags: number): Promise<StakeholderMasterFileHandle>;
}

const nodeFileSystem: StakeholderMasterFileSystem = {
  realpath,
  lstat,
  readdir,
  open: async (path, flags) => {
    const handle = await open(path, flags);
    return {
      stat: () => handle.stat(),
      readFile: () => handle.readFile("utf8"),
      close: () => handle.close(),
    };
  },
};
const OPEN_FLAGS = constants.O_RDONLY | constants.O_NOFOLLOW;
const stakeholderLookingFilename = /^ST-.*\.yaml$/;
const prjopsProfileSchema = z.enum(["PRF-01", "PRF-02", "PRF-03", "PRF-04", "PRF-05", "investor"]);
const assignmentSchema = z
  .object({
    domain: z.enum(["prjops", "devops"]),
    profile: z.enum(["PRF-01", "PRF-M", "PRF-02", "PRF-L", "PRF-03", "PRF-G", "PRF-04", "PRF-05", "investor"]),
    scope_mode: z.enum(["project", "global"]),
    project_id: z.string().nullable(),
    active: z.boolean(),
  })
  .superRefine((assignment, ctx) => {
    const validProfile =
      assignment.domain === "prjops"
        ? prjopsProfileSchema.safeParse(assignment.profile).success
        : ["PRF-M", "PRF-L", "PRF-G"].includes(assignment.profile);
    if (!validProfile) ctx.addIssue({ code: "custom", message: "profile does not belong to domain" });
    if (assignment.scope_mode === "project") {
      if (assignment.project_id === null || !isValidId("project", assignment.project_id)) {
        ctx.addIssue({ code: "custom", message: "project scope requires a canonical project ID" });
      }
    } else {
      if (assignment.project_id !== null)
        ctx.addIssue({ code: "custom", message: "global scope requires null project" });
      if (assignment.profile !== "PRF-04" && assignment.profile !== "PRF-G") {
        ctx.addIssue({ code: "custom", message: "global scope is restricted to PRF-04/PRF-G" });
      }
    }
  });
const canonicalId = (kind: "stakeholder" | "organization" | "project") =>
  z.string().refine((value) => isValidId(kind, value), `invalid ${kind} ID`);
const canonicalizeEmail = (value: string) => value.trim().normalize("NFC").toLowerCase();
const emailSchema = z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
const uuidSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
const stakeholderSchema = z
  .object({
    id: canonicalId("stakeholder"),
    name: z.string().trim().min(1),
    organization_id: canonicalId("organization"),
    entra_tenant_id: uuidSchema,
    entra_object_id: uuidSchema,
    assignments: z.array(assignmentSchema).min(1),
    invested_project_ids: z.array(canonicalId("project")).refine((ids) => new Set(ids).size === ids.length),
    email: z.string().transform(canonicalizeEmail).pipe(emailSchema),
    teams_user_id: z.string().trim().min(1).nullable().optional(),
    preferred_language: z.enum(["ja", "en"]),
    timezone: z.string().trim().min(1),
    active: z.boolean(),
  })
  .passthrough();
type ParsedStakeholder = z.infer<typeof stakeholderSchema>;

/**
 * YAML関係者マスタを毎回読み直す、Webの既存Providerと構造互換な実装。
 * ファイル数・サイズ上限は正本値を推測せず、T-P0-10c のdeployment/load gateで定義・検証する。
 * production の directory と祖先は absolute canonical real path の immutable/non-symlink trust boundary とする。
 * scan前後の dev/ino 比較は通常の置換を検出するが、ABA置換や同一権限writerを完全には防げない。
 */
export class YamlStakeholderMasterProvider implements StakeholderMasterProvider {
  constructor(
    private readonly directory: string,
    private readonly fs: StakeholderMasterFileSystem = nodeFileSystem,
  ) {
    if (!isAbsolute(directory) || resolve(directory) !== directory) {
      throw new Error("Stakeholder directory must be an absolute canonical path");
    }
  }

  private async directoryIdentity(): Promise<{ dev: number | bigint; ino: number | bigint }> {
    if ((await this.fs.realpath(this.directory)) !== this.directory) {
      throw new Error("Stakeholder directory must be canonical and contain no symlinks");
    }
    const stat = await this.fs.lstat(this.directory);
    if (!stat.isDirectory()) throw new Error("Stakeholder directory is not a directory");
    return { dev: stat.dev, ino: stat.ino };
  }

  private async readAll(): Promise<ParsedStakeholder[]> {
    const initialDirectory = await this.directoryIdentity();
    const stakeholders: ParsedStakeholder[] = [];
    const emailOwners = new Map<string, string>();
    const subjectOwners = new Map<string, string>();
    const teamsUserOwners = new Map<string, string>();

    for (const filename of (await this.fs.readdir(this.directory)).sort()) {
      if (!stakeholderLookingFilename.test(filename)) continue;
      const filenameId = filename.slice(0, -".yaml".length);
      if (!isValidId("stakeholder", filenameId)) throw new Error(`Invalid stakeholder filename: ${filename}`);
      const path = join(this.directory, filename);
      let input: z.infer<typeof stakeholderSchema>;
      let handle: StakeholderMasterFileHandle | undefined;
      try {
        handle = await this.fs.open(path, OPEN_FLAGS);
        if (!(await handle.stat()).isFile()) throw new Error(`Stakeholder entry is not a file: ${filename}`);
        input = stakeholderSchema.parse(parseYaml(await handle.readFile()));
      } catch (error) {
        throw new Error(`Invalid stakeholder YAML ${filename}`, { cause: error });
      } finally {
        await handle?.close();
      }

      if (input.id !== filenameId) {
        throw new Error(`Stakeholder filename ${filename} does not match id ${input.id}`);
      }
      const assignments = new Set<string>();
      for (const assignment of input.assignments) {
        const canonicalProfile = assignment.profile === "investor" ? "PRF-05" : assignment.profile;
        const key = [
          assignment.domain,
          canonicalProfile,
          assignment.scope_mode,
          assignment.project_id ?? "global",
        ].join(":");
        if (assignments.has(key)) throw new Error(`Duplicate stakeholder assignment: ${input.id} ${key}`);
        assignments.add(key);
      }

      const emailOwner = emailOwners.get(input.email);
      if (emailOwner && emailOwner !== input.id) {
        throw new Error(`Duplicate normalized stakeholder email: ${input.email} (${emailOwner}/${input.id})`);
      }
      emailOwners.set(input.email, input.id);
      const subject = `${input.entra_tenant_id}:${input.entra_object_id}`;
      const subjectOwner = subjectOwners.get(subject);
      if (subjectOwner && subjectOwner !== input.id) {
        throw new Error(`Duplicate stakeholder stable subject: ${subject} (${subjectOwner}/${input.id})`);
      }
      subjectOwners.set(subject, input.id);
      if (input.teams_user_id) {
        const teamsUserOwner = teamsUserOwners.get(input.teams_user_id);
        if (teamsUserOwner && teamsUserOwner !== input.id) {
          throw new Error(`Duplicate Teams user ID: ${input.teams_user_id} (${teamsUserOwner}/${input.id})`);
        }
        teamsUserOwners.set(input.teams_user_id, input.id);
      }
      stakeholders.push(input);
    }

    const finalDirectory = await this.directoryIdentity();
    if (initialDirectory.dev !== finalDirectory.dev || initialDirectory.ino !== finalDirectory.ino) {
      throw new Error("Stakeholder directory changed during scan");
    }
    return stakeholders;
  }

  async findBySubject(subject: EntraSubject): Promise<StakeholderRecord[]> {
    const stakeholders = await this.readAll();

    const records: StakeholderRecord[] = [];
    for (const input of stakeholders) {
      if (input.entra_tenant_id !== subject.tenantId || input.entra_object_id !== subject.objectId || !input.active) {
        continue;
      }
      for (const assignment of input.assignments) {
        if (assignment.domain !== "prjops") continue;
        const profile = assignment.profile as Profile | "investor";
        if (
          (profile === "PRF-05" || profile === "investor") &&
          (assignment.scope_mode !== "project" ||
            assignment.project_id === null ||
            !input.invested_project_ids.includes(assignment.project_id))
        ) {
          continue;
        }
        const domain = profile === "PRF-05" || profile === "investor" ? "investor" : "prjops";
        const scope =
          assignment.scope_mode === "global"
            ? ({ mode: "global", projectId: null } as const)
            : ({ mode: "project", projectId: assignment.project_id! } as const);
        records.push({
          stakeholderId: input.id,
          subject: { tenantId: input.entra_tenant_id, objectId: input.entra_object_id },
          active: input.active,
          assignmentActive: assignment.active,
          domain,
          profile,
          scope,
        });
      }
    }
    return records;
  }

  async findProfileByTeamsUserId(teamsUserId: string | null, projectId: string): Promise<Profile | null> {
    if (!teamsUserId) return null;
    const stakeholder = (await this.readAll()).find((input) => input.teams_user_id === teamsUserId);
    if (!stakeholder?.active) return null;
    const assignments = stakeholder.assignments.filter(
      (candidate) =>
        candidate.domain === "prjops" &&
        candidate.active &&
        candidate.scope_mode === "project" &&
        candidate.project_id === projectId &&
        candidate.profile !== "investor",
    );
    return assignments.length === 1 ? (assignments[0]!.profile as Profile) : null;
  }
}
