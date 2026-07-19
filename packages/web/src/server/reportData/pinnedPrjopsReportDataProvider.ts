/**
 * 根拠: P010-F02-T07 / DEC-SPEC-001 / PrjOps:REQ-041
 *
 * immutable commitで公開されたprjops-data snapshotをrequestごとに読み、A012 validatorの
 * 全体検証後だけprofile/stakeholder/project条件を適用してreport dataを返す。
 */
import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import {
  SEVEN_KEY_DEFINITIONS,
  canShowPersonalNames,
  validatePrjopsDataSnapshot,
  type SnapshotEntry,
  type ValidatedSnapshotDocument,
  type SevenKeyId,
  type SevenKeysRag,
} from "@aiops/prjops";
import type { WebConfig } from "../config";
import type { EntraSubject, StakeholderMasterProvider, StakeholderRecord } from "../personaResolver";
import type {
  PrjopsProjectRecord,
  PrjopsReportDataProvider,
  PrjopsReportDataQuery,
  ScopedPrjopsReportData,
} from "./prjopsReportData";

const COMMIT_SHA = /^[0-9a-f]{40}$/;
const CONTENT_SHA256 = /^[0-9a-f]{64}$/;
const ALLOWED_DIRECTORIES = new Set([
  "actions",
  "investor",
  "issues",
  "organizations",
  "projects",
  "report_jobs",
  "schema",
  "seven_keys",
  "seven_keys/questionnaires",
  "seven_keys/snapshots",
  "stakeholders",
  "status_updates",
]);

export class PrjopsDataUnavailableError extends Error {
  public readonly status = 503 as const;

  constructor(public readonly reason: string) {
    super("E-DATA01: PrjOps data is unavailable");
    this.name = "PrjopsDataUnavailableError";
  }
}

export class PrjopsDataAccessDeniedError extends Error {
  public readonly status = 403 as const;

  constructor() {
    super("E-AUTH02: PrjOps report scope is no longer active");
    this.name = "PrjopsDataAccessDeniedError";
  }
}

export interface PrjopsSnapshotSource {
  load(): Promise<{ commitSha: string; entries: SnapshotEntry[] }>;
}

/** Exported checkout directory。commitShaはpublisherが付与したcheckout provenance。 */
export class FileSystemPrjopsSnapshotSource implements PrjopsSnapshotSource {
  constructor(
    private readonly directory: string,
    private readonly commitSha: string,
  ) {
    if (!isAbsolute(directory) || resolve(directory) !== directory) {
      throw new PrjopsDataUnavailableError("snapshot directory is not an absolute canonical path");
    }
  }

  async load(): Promise<{ commitSha: string; entries: SnapshotEntry[] }> {
    try {
      if ((await realpath(this.directory)) !== this.directory) {
        throw new Error("snapshot root is a symlink");
      }
      const initial = await lstat(this.directory);
      if (!initial.isDirectory()) throw new Error("snapshot root is not a directory");

      const entries: SnapshotEntry[] = [];
      await this.readDirectory(this.directory, "", entries);

      const final = await lstat(this.directory);
      if (initial.dev !== final.dev || initial.ino !== final.ino) {
        throw new Error("snapshot root changed during scan");
      }
      return { commitSha: this.commitSha, entries };
    } catch (error) {
      if (error instanceof PrjopsDataUnavailableError) throw error;
      throw new PrjopsDataUnavailableError(`snapshot read failed: ${String(error)}`);
    }
  }

  private async readDirectory(directory: string, relativeDirectory: string, entries: SnapshotEntry[]): Promise<void> {
    for (const name of (await readdir(directory)).sort()) {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${name}` : name;
      const path = join(directory, name);
      const stat = await lstat(path);
      if (stat.isSymbolicLink()) {
        entries.push({ path: relativePath, kind: "symlink", bytes: new Uint8Array() });
      } else if (stat.isDirectory()) {
        if (!ALLOWED_DIRECTORIES.has(relativePath)) {
          throw new Error(`unknown snapshot directory: ${relativePath}`);
        }
        await this.readDirectory(path, relativePath, entries);
      } else if (stat.isFile()) {
        const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
          if (!(await handle.stat()).isFile()) {
            entries.push({ path: relativePath, kind: "nonregular", bytes: new Uint8Array() });
          } else {
            entries.push({ path: relativePath, kind: "regular", bytes: await handle.readFile() });
          }
        } finally {
          await handle.close();
        }
      } else {
        entries.push({ path: relativePath, kind: "nonregular", bytes: new Uint8Array() });
      }
    }
  }
}

interface AssignmentDocument {
  domain: "prjops" | "devops";
  profile: string;
  scope_mode: "project" | "global";
  project_id: string | null;
  active: boolean;
}

interface StakeholderDocument {
  id: string;
  name: string;
  entra_tenant_id: string;
  entra_object_id: string;
  assignments: AssignmentDocument[];
  invested_project_ids: string[];
  active: boolean;
}

function documentsOfKind(
  documents: readonly ValidatedSnapshotDocument[],
  kind: ValidatedSnapshotDocument["kind"],
): Array<Record<string, unknown>> {
  return documents.filter((entry) => entry.kind === kind).map((entry) => entry.document);
}

function stakeholderDocuments(documents: readonly ValidatedSnapshotDocument[]): StakeholderDocument[] {
  return documentsOfKind(documents, "stakeholder") as unknown as StakeholderDocument[];
}

function sameSubject(stakeholder: StakeholderDocument, subject: EntraSubject): boolean {
  return stakeholder.entra_tenant_id === subject.tenantId && stakeholder.entra_object_id === subject.objectId;
}

function assignmentProfileMatches(assignment: AssignmentDocument, profile: PrjopsReportDataQuery["profile"]): boolean {
  return profile === "PRF-05"
    ? assignment.profile === "PRF-05" || assignment.profile === "investor"
    : assignment.profile === profile;
}

function requestedProjectIds(input: PrjopsReportDataQuery): string[] {
  if (input.visibility.scopeMode !== "project") return [];
  switch (input.profile) {
    case "PRF-01":
      return input.visibility.recipientParticipatingProjectIds;
    case "PRF-02":
      return input.visibility.recipientAssignedProjectIds;
    case "PRF-03":
    case "PRF-04":
      return input.visibility.recipientManagedProjectIds;
    case "PRF-05":
      return input.visibility.investedProjectIds;
  }
}

function authorizedProjectIds(
  documents: readonly ValidatedSnapshotDocument[],
  input: PrjopsReportDataQuery,
): Set<string> {
  const stakeholder = stakeholderDocuments(documents).find(
    (candidate) => candidate.id === input.visibility.recipientStakeholderId && candidate.active,
  );
  if (!stakeholder) throw new PrjopsDataAccessDeniedError();

  const assignments = stakeholder.assignments.filter(
    (assignment) =>
      assignment.domain === "prjops" && assignment.active && assignmentProfileMatches(assignment, input.profile),
  );
  const activeProjects = new Set(
    documentsOfKind(documents, "project")
      .filter((project) => project["active"] === true)
      .map((project) => project["id"] as string),
  );

  if (input.visibility.scopeMode === "global") {
    if (
      input.profile !== "PRF-04" ||
      !assignments.some((assignment) => assignment.scope_mode === "global" && assignment.project_id === null)
    ) {
      throw new PrjopsDataAccessDeniedError();
    }
    return activeProjects;
  }
  if (input.visibility.scopeMode !== "project") throw new PrjopsDataAccessDeniedError();

  const requested = requestedProjectIds(input);
  const assigned = new Set(
    assignments
      .filter((assignment) => assignment.scope_mode === "project" && assignment.project_id !== null)
      .map((assignment) => assignment.project_id!),
  );
  if (
    requested.length === 0 ||
    requested.some(
      (projectId) =>
        !assigned.has(projectId) ||
        !activeProjects.has(projectId) ||
        (input.profile === "PRF-05" && !stakeholder.invested_project_ids.includes(projectId)),
    )
  ) {
    throw new PrjopsDataAccessDeniedError();
  }
  return new Set(requested);
}

function latestByUpdatedAt(documents: Array<Record<string, unknown>>): Map<string, Record<string, unknown>> {
  const latest = new Map<string, Record<string, unknown>>();
  for (const document of documents) {
    const projectId = document["project_id"] as string;
    const previous = latest.get(projectId);
    if (!previous || Date.parse(document["updated_at"] as string) > Date.parse(previous["updated_at"] as string)) {
      latest.set(projectId, document);
    }
  }
  return latest;
}

function finiteOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

const keyTitles = new Map(SEVEN_KEY_DEFINITIONS.map((definition) => [definition.id, definition.title]));

export class PinnedPrjopsReportDataProvider implements PrjopsReportDataProvider, StakeholderMasterProvider {
  constructor(
    private readonly source: PrjopsSnapshotSource,
    private readonly expectedCommitSha: string,
    private readonly expectedContentSha256: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async validatedDocuments(): Promise<ValidatedSnapshotDocument[]> {
    if (!COMMIT_SHA.test(this.expectedCommitSha) || !CONTENT_SHA256.test(this.expectedContentSha256)) {
      throw new PrjopsDataUnavailableError("invalid pinned snapshot identity");
    }
    const snapshot = await this.source.load();
    if (snapshot.commitSha !== this.expectedCommitSha) {
      throw new PrjopsDataUnavailableError("snapshot commit mismatch");
    }
    const validation = validatePrjopsDataSnapshot(snapshot.entries);
    if (!validation.ok) {
      throw new PrjopsDataUnavailableError(validation.code);
    }
    if (validation.contentSha256 !== this.expectedContentSha256) {
      throw new PrjopsDataUnavailableError("snapshot checksum inventory mismatch");
    }
    return validation.documents;
  }

  async findBySubject(subject: EntraSubject): Promise<StakeholderRecord[]> {
    const documents = await this.validatedDocuments();
    const stakeholder = stakeholderDocuments(documents).find(
      (candidate) => candidate.active && sameSubject(candidate, subject),
    );
    if (!stakeholder) return [];

    const records: StakeholderRecord[] = [];
    for (const assignment of stakeholder.assignments) {
      if (assignment.domain !== "prjops") continue;
      const profile = assignment.profile === "investor" ? "investor" : assignment.profile;
      if (!["PRF-01", "PRF-02", "PRF-03", "PRF-04", "PRF-05", "investor"].includes(profile)) continue;
      if (
        (profile === "PRF-05" || profile === "investor") &&
        (assignment.scope_mode !== "project" ||
          assignment.project_id === null ||
          !stakeholder.invested_project_ids.includes(assignment.project_id))
      ) {
        continue;
      }
      records.push({
        stakeholderId: stakeholder.id,
        subject,
        active: stakeholder.active,
        assignmentActive: assignment.active,
        domain: profile === "PRF-05" || profile === "investor" ? "investor" : "prjops",
        profile: profile as StakeholderRecord["profile"],
        scope:
          assignment.scope_mode === "global"
            ? { mode: "global", projectId: null }
            : { mode: "project", projectId: assignment.project_id! },
      });
    }
    return records;
  }

  async query(input: PrjopsReportDataQuery): Promise<ScopedPrjopsReportData> {
    const documents = await this.validatedDocuments();
    const allowed = authorizedProjectIds(documents, input);
    const investor = input.profile === "PRF-05";
    const stakeholders = new Map(stakeholderDocuments(documents).map((stakeholder) => [stakeholder.id, stakeholder]));
    const statusUpdates = latestByUpdatedAt(
      documentsOfKind(documents, "statusUpdate").filter(
        (update) =>
          update["active"] === true && update["complete"] === true && allowed.has(update["project_id"] as string),
      ),
    );
    const issues = documentsOfKind(documents, "issue").filter(
      (issue) => issue["active"] === true && allowed.has(issue["project_id"] as string),
    );
    const actions = documentsOfKind(documents, "action").filter(
      (action) => action["active"] === true && allowed.has(action["project_id"] as string),
    );
    const financial = documentsOfKind(documents, "financialInputs")[0]!;
    const financialByProject = new Map(
      (financial["projects"] as Array<Record<string, unknown>>).map((project) => [
        project["project_id"] as string,
        project,
      ]),
    );
    const today = this.now().toISOString().slice(0, 10);

    const projects: PrjopsProjectRecord[] = documentsOfKind(documents, "project")
      .filter((project) => project["active"] === true && allowed.has(project["id"] as string))
      .map((project) => {
        const projectId = project["id"] as string;
        const latest = statusUpdates.get(projectId);
        const projectActions = actions.filter((action) => action["project_id"] === projectId);
        const finance = financialByProject.get(projectId);
        const progressPct = (latest?.["progress_pct"] as number | undefined) ?? 0;
        return {
          projectId,
          name: project["name"] as string,
          color: (latest?.["self_status"] as PrjopsProjectRecord["color"] | undefined) ?? "grey",
          startDate: project["start_date"] as string,
          endDate: project["end_date"] as string,
          progressPct,
          highSeverityOpenIssueCount: issues.filter(
            (issue) =>
              issue["project_id"] === projectId &&
              issue["status"] === "open" &&
              (issue["severity"] === "high" || issue["severity"] === "critical"),
          ).length,
          isOverdue:
            ((project["end_date"] as string) < today && progressPct < 100) ||
            projectActions.some((action) => action["status"] === "open" && (action["due"] as string) < today),
          periodLabel: `${project["start_date"] as string}〜${project["end_date"] as string}`,
          ownerName: canShowPersonalNames(input.profile)
            ? (stakeholders.get(project["manager_id"] as string)?.name ?? (project["manager_id"] as string))
            : "",
          ownershipPct: investor ? finiteOrUndefined(finance?.["ownership_pct"]) : undefined,
          revenue: investor ? finiteOrUndefined(finance?.["revenue"]) : undefined,
          ebitda: investor ? finiteOrUndefined(finance?.["ebitda"]) : undefined,
        };
      });

    const sevenKeysQuestionnaires = documentsOfKind(documents, "questionnaire")
      .filter((questionnaire) => questionnaire["active"] === true && allowed.has(questionnaire["project_id"] as string))
      .map((questionnaire) => {
        const answers = questionnaire["answers"] as Record<string, SevenKeysRag>;
        return {
          projectId: questionnaire["project_id"] as string,
          month: questionnaire["month"] as string,
          answers: {
            stakeholdersCommitted: answers["stakeholders_committed"],
            businessBenefits: answers["business_benefits"],
            riskMitigation: answers["risk_mitigation"],
            deliveryOrgBenefits: answers["delivery_org_benefits"],
          },
        };
      });
    const sevenKeysMonthlySnapshots = documentsOfKind(documents, "sevenKeysSnapshot")
      .filter((snapshot) => allowed.has(snapshot["project_id"] as string))
      .map((snapshot) => ({
        projectId: snapshot["project_id"] as string,
        month: snapshot["month"] as string,
        name: snapshot["name"] as string,
        keys: (snapshot["keys"] as Array<Record<string, unknown>>).map((key) => ({
          keyId: key["key_id"] as SevenKeyId,
          title: keyTitles.get(key["key_id"] as SevenKeyId)!,
          rag: key["rag"] as SevenKeysRag,
          basis: key["basis"] as string,
        })),
        improvedKeys: snapshot["improved_keys"] as SevenKeyId[],
        worsenedKeys: snapshot["worsened_keys"] as SevenKeyId[],
      }));
    const boardPack = documentsOfKind(documents, "boardPack")[0]!;
    const targets = boardPack["targets"] as Record<string, number | null>;

    return {
      projects,
      issuesAndActions: [
        ...issues.map((issue) => ({
          projectId: issue["project_id"] as string,
          createdAt: issue["created_at"] as string,
          closedAt: issue["status"] === "closed" ? (issue["updated_at"] as string) : null,
        })),
        ...actions.map((action) => ({
          projectId: action["project_id"] as string,
          createdAt: action["created_at"] as string,
          closedAt: action["status"] === "open" ? null : (action["updated_at"] as string),
        })),
      ],
      sevenKeysMonthlySnapshots: input.profile === "PRF-04" ? sevenKeysMonthlySnapshots : [],
      sevenKeysQuestionnaires: input.profile === "PRF-04" ? sevenKeysQuestionnaires : [],
      investorFinancialInputs: {},
      investorBoardPackInputs: investor
        ? {
            targets: {
              revenue: targets["revenue"] ?? undefined,
              ebitda: targets["ebitda"] ?? undefined,
            },
            history: (boardPack["history"] as Array<Record<string, unknown>>).map((history) => ({
              companies: (history["companies"] as Array<Record<string, unknown>>)
                .filter((company) => allowed.has(company["project_id"] as string))
                .map((company) => ({
                  projectId: company["project_id"] as string,
                  ownershipPct: company["ownership_pct"] as number,
                  revenue: finiteOrUndefined(company["revenue"]),
                  ebitda: finiteOrUndefined(company["ebitda"]),
                })),
            })),
          }
        : {},
    };
  }
}

export function createPinnedPrjopsReportDataProvider(
  config: WebConfig,
  source?: PrjopsSnapshotSource,
): PinnedPrjopsReportDataProvider {
  if (
    !config.PRJOPS_DATA_DIR ||
    !config.PRJOPS_DATA_COMMIT_SHA ||
    !config.PRJOPS_DATA_SOURCE_COMMIT_SHA ||
    !config.PRJOPS_DATA_CONTENT_SHA256
  ) {
    throw new PrjopsDataUnavailableError("PrjOps data configuration is incomplete");
  }
  return new PinnedPrjopsReportDataProvider(
    source ?? new FileSystemPrjopsSnapshotSource(config.PRJOPS_DATA_DIR, config.PRJOPS_DATA_SOURCE_COMMIT_SHA),
    config.PRJOPS_DATA_COMMIT_SHA,
    config.PRJOPS_DATA_CONTENT_SHA256,
  );
}
