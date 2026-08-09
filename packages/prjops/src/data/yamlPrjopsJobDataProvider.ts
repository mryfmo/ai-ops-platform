/**
 * packages/prjops/src/data/yamlPrjopsJobDataProvider.ts
 *
 * 根拠: PrjOps:REQ-001/002/007/009 / PrjOps:SPEC-INT-010/020/025/032 / DEC-SPEC-001。
 * owner-pinned immutable prjops-data snapshotを全体検証してから、scheduler用のactive projectと
 * open action入力だけを決定的に投影する。snapshotはruntime read-onlyである。
 */
import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { todayJstDateString } from "@aiops/shared";
import type { ProjectJudgementRequest } from "../agents/AGT03_analyzer.js";
import type { StatusColor } from "../lib/statusJudge.js";
import {
  validatePrjopsDataSnapshot,
  type SnapshotEntry,
  type ValidatedSnapshotDocument,
} from "../lib/prjopsDataSnapshotValidator.js";

const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
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

export interface PrjopsJobSnapshotSource {
  load(): Promise<{ commitSha: string; entries: SnapshotEntry[] }>;
}

export class FileSystemPrjopsJobSnapshotSource implements PrjopsJobSnapshotSource {
  constructor(
    private readonly directory: string,
    private readonly commitSha: string,
  ) {
    if (!isAbsolute(directory) || resolve(directory) !== directory) {
      throw new Error("PrjOps snapshot directory must be an absolute canonical path");
    }
  }

  async load(): Promise<{ commitSha: string; entries: SnapshotEntry[] }> {
    if ((await realpath(this.directory)) !== this.directory) throw new Error("PrjOps snapshot root is a symlink");
    const initial = await lstat(this.directory);
    if (!initial.isDirectory()) throw new Error("PrjOps snapshot root is not a directory");
    const entries: SnapshotEntry[] = [];
    await this.scan(this.directory, "", entries);
    const final = await lstat(this.directory);
    if (initial.dev !== final.dev || initial.ino !== final.ino) throw new Error("PrjOps snapshot changed during scan");
    return { commitSha: this.commitSha, entries };
  }

  private async scan(directory: string, relativeDirectory: string, entries: SnapshotEntry[]): Promise<void> {
    for (const name of (await readdir(directory)).sort()) {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${name}` : name;
      const path = join(directory, name);
      const stat = await lstat(path);
      if (stat.isSymbolicLink()) {
        entries.push({ path: relativePath, kind: "symlink", bytes: new Uint8Array() });
      } else if (stat.isDirectory()) {
        if (!ALLOWED_DIRECTORIES.has(relativePath))
          throw new Error(`Unknown PrjOps snapshot directory: ${relativePath}`);
        await this.scan(path, relativePath, entries);
      } else if (stat.isFile()) {
        const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
          entries.push({
            path: relativePath,
            kind: (await handle.stat()).isFile() ? "regular" : "nonregular",
            bytes: await handle.readFile(),
          });
        } finally {
          await handle.close();
        }
      } else {
        entries.push({ path: relativePath, kind: "nonregular", bytes: new Uint8Array() });
      }
    }
  }
}

export interface PrjopsDailyActionInput {
  id: string;
  projectId: string;
  due: string;
  status: "open";
  assigneeEmail: string;
  managerEmail: string;
  remindersSentCountBaseline: number;
}

function documentsOfKind(
  documents: readonly ValidatedSnapshotDocument[],
  kind: ValidatedSnapshotDocument["kind"],
): Array<Record<string, unknown>> {
  return documents.filter((entry) => entry.kind === kind).map((entry) => entry.document);
}

function latestStatusByProject(documents: readonly ValidatedSnapshotDocument[]): Map<string, Record<string, unknown>> {
  const latest = new Map<string, Record<string, unknown>>();
  for (const update of documentsOfKind(documents, "statusUpdate")) {
    if (update["active"] !== true || update["complete"] !== true) continue;
    const projectId = String(update["project_id"]);
    const previous = latest.get(projectId);
    if (!previous || Date.parse(String(update["updated_at"])) > Date.parse(String(previous["updated_at"]))) {
      latest.set(projectId, update);
    }
  }
  return latest;
}

export class YamlPrjopsJobDataProvider {
  constructor(
    private readonly source: PrjopsJobSnapshotSource,
    private readonly expectedCommitSha: string,
    private readonly expectedContentSha256: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async documents(): Promise<ValidatedSnapshotDocument[]> {
    if (!SHA40.test(this.expectedCommitSha) || !SHA256.test(this.expectedContentSha256)) {
      throw new Error("Invalid pinned PrjOps snapshot identity");
    }
    const snapshot = await this.source.load();
    if (snapshot.commitSha !== this.expectedCommitSha) throw new Error("PrjOps snapshot commit mismatch");
    const validation = validatePrjopsDataSnapshot(snapshot.entries);
    if (!validation.ok) throw new Error(`PrjOps snapshot validation failed: ${validation.code}`);
    if (validation.contentSha256 !== this.expectedContentSha256) throw new Error("PrjOps snapshot checksum mismatch");
    return validation.documents;
  }

  async listActiveProjects(): Promise<ProjectJudgementRequest[]> {
    const documents = await this.documents();
    const projects = documentsOfKind(documents, "project").filter(
      (project) => project["active"] === true && project["status"] === "active",
    );
    const projectIds = new Set(projects.map((project) => String(project["id"])));
    const latest = latestStatusByProject(documents);
    const issues = documentsOfKind(documents, "issue").filter(
      (issue) => issue["active"] === true && issue["status"] === "open" && projectIds.has(String(issue["project_id"])),
    );
    const actions = documentsOfKind(documents, "action").filter(
      (action) =>
        action["active"] === true && action["status"] === "open" && projectIds.has(String(action["project_id"])),
    );
    const currentDate = todayJstDateString(this.now());
    return projects
      .map((project) => {
        const projectId = String(project["id"]);
        const update = latest.get(projectId);
        if (!update) throw new Error(`Active project has no complete status update: ${projectId}`);
        return {
          projectId,
          startDate: String(project["start_date"]),
          endDate: String(project["end_date"]),
          asOfDate: currentDate,
          progressPct: Number(update["progress_pct"]),
          highSeverityOpenIssueCount: issues.filter(
            (issue) =>
              issue["project_id"] === projectId && (issue["severity"] === "high" || issue["severity"] === "critical"),
          ).length,
          overdueActionCount: actions.filter(
            (action) => action["project_id"] === projectId && String(action["due"]) < currentDate,
          ).length,
          selfStatus: update["self_status"] as StatusColor,
        };
      })
      .sort((a, b) => a.projectId.localeCompare(b.projectId));
  }

  async listOpenActions(): Promise<PrjopsDailyActionInput[]> {
    const documents = await this.documents();
    const stakeholders = new Map(
      documentsOfKind(documents, "stakeholder")
        .filter((stakeholder) => stakeholder["active"] === true)
        .map((stakeholder) => [String(stakeholder["id"]), stakeholder]),
    );
    const projects = new Map(
      documentsOfKind(documents, "project")
        .filter((project) => project["active"] === true && project["status"] === "active")
        .map((project) => [String(project["id"]), project]),
    );
    return documentsOfKind(documents, "action")
      .filter((action) => action["active"] === true && action["status"] === "open")
      .map((action) => {
        const projectId = String(action["project_id"]);
        const project = projects.get(projectId);
        if (!project) throw new Error(`Open action references inactive project: ${projectId}`);
        const assignee = stakeholders.get(String(action["assignee"]));
        const manager = stakeholders.get(String(project["manager_id"]));
        if (!assignee || !manager) throw new Error(`Open action recipient mapping is missing: ${String(action["id"])}`);
        return {
          id: String(action["id"]),
          projectId,
          due: String(action["due"]),
          status: "open" as const,
          assigneeEmail: String(assignee["email"]),
          managerEmail: String(manager["email"]),
          remindersSentCountBaseline: (action["reminders_sent"] as unknown[]).length,
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));
  }
}
