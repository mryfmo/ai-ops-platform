/**
 * packages/server/src/lib/devopsEventHandlers.ts
 *
 * 根拠: DevOps:REQ-001 / DevOps:REQ-002 / DevOps:REQ-015,
 * DevOps:SPEC-INT-011 / DevOps:SPEC-INT-030, ADR-0014。
 *
 * A053 partial-compliance boundary:
 * DevOps:SPEC-INT-030 requires feature-similarity search over incidents from the past 90 days. A045 can only
 * derive a recency-ordered proxy from devops_1y `triage` audit records. The injected provider seam keeps
 * that limitation loud and replaceable; recency is not represented as feature similarity.
 *
 * 外部I/OとLLMは全て注入する。このファイルはpayloadの検証、分岐、サニタイズ、監査detail合成だけを担う。
 */
import { createHash } from "node:crypto";
import {
  sanitizeForLlmInput,
  sanitizeSecrets,
  type AuditLogWriter,
  type AuditRecord,
  type ChannelRef,
  type CreateIssueCommentInput,
  type CreateIssueInput,
} from "@aiops/shared";
import type { ClassificationResult, IncidentClassification } from "@aiops/devops";
import type { DevopsEventHandler } from "./githubEventRouter.js";

type BuildClassifier = (
  evidence: string,
  deps: { auditLog: AuditLogWriter; traceId: string },
) => Promise<ClassificationResult>;
type BuildSuggestionGenerator = (
  classification: ClassificationResult,
  repoCheckoutPath: string,
  deps: { auditLog: AuditLogWriter; traceId: string },
) => Promise<string | null>;

export interface BuildHandlerDeps {
  configured: boolean;
  disabledReason?: string;
  githubClient: {
    getWorkflowRunFailureLog(owner: string, repo: string, runId: number): Promise<string>;
    createIssueComment(input: CreateIssueCommentInput): Promise<void>;
    createIssue(input: CreateIssueInput): Promise<{ number: number; htmlUrl: string }>;
  };
  auditLog: AuditLogWriter;
  classify: BuildClassifier;
  generate: BuildSuggestionGenerator;
  repoCheckoutPath: string;
}

type IncidentClassifier = (
  alert: string,
  metrics: string,
  similarIncidents: string,
  deps: { auditLog: AuditLogWriter; traceId: string },
) => Promise<IncidentClassification>;
type IncidentTriage = (
  classification: IncidentClassification,
  owner: string,
  repo: string,
  channel: ChannelRef,
  deps: { auditLog: AuditLogWriter; traceId: string },
) => Promise<{ issueUrl: string; effectiveSeverity: string }>;

export interface SimilarIncidentRecord {
  at: string;
  detail: unknown;
}

export interface SimilarIncidentsProvider {
  summarize(): Promise<string>;
}

export type RecentTriageReader = (query: { since: string; limit: 5 }) => Promise<readonly SimilarIncidentRecord[]>;

export interface IncidentHandlerDeps {
  configured: boolean;
  disabledReason?: string;
  channel?: ChannelRef;
  metricsSnapshot(): string;
  similarIncidents: SimilarIncidentsProvider;
  auditLog: AuditLogWriter;
  classify: IncidentClassifier;
  triage: IncidentTriage;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function repositoryCoordinates(payload: Record<string, unknown>): { owner: string; repo: string; fullName: string } {
  const repository = asRecord(payload["repository"]);
  const fullName = repository?.["full_name"];
  if (typeof fullName !== "string") throw new Error("Malformed GitHub event: repository.full_name is required");
  const parts = fullName.split("/");
  if (parts.length !== 2 || parts.some((part) => part.length === 0)) {
    throw new Error("Malformed GitHub event: repository.full_name must be owner/repo");
  }
  return { owner: parts[0]!, repo: parts[1]!, fullName };
}

async function appendReceipt(
  auditLog: AuditLogWriter,
  actor: "AGT-BLD" | "AGT-INC",
  basis: string,
  eventName: string,
  traceId: string,
): Promise<void> {
  await auditLog.append({
    trace_id: traceId,
    actor,
    action: "github_event_received",
    basis,
    detail: { eventName },
    at: new Date().toISOString(),
  });
}

function renderBuildResult(classification: ClassificationResult, suggestion: string | null, runUrl: string): string {
  const raw = [
    "## Build failure triage",
    "<!-- aiops-agent:AGT-BLD -->",
    "",
    `- Classification: ${classification.classification}`,
    `- Failed job: ${classification.failed_job}`,
    `- Failed step: ${classification.failed_step}`,
    `- Confidence: ${classification.confidence}`,
    `- Workflow run: ${runUrl}`,
    "",
    "### Log excerpt",
    classification.log_excerpt,
    ...(suggestion ? ["", "### Read-only fix suggestion", suggestion] : []),
  ].join("\n");
  return sanitizeSecrets(raw).sanitized;
}

export function createBuildEventHandler(deps: BuildHandlerDeps): DevopsEventHandler {
  return async (event, traceId) => {
    await appendReceipt(deps.auditLog, "AGT-BLD", "DevOps:SPEC-INT-011", event.eventName, traceId);
    if (event.eventName !== "workflow_run") return;
    const payload = asRecord(event.payload);
    const workflowRun = payload && asRecord(payload["workflow_run"]);
    if (!payload || !workflowRun) throw new Error("Malformed workflow_run event payload");
    if (payload["action"] !== "completed" || workflowRun["conclusion"] !== "failure") return;
    const repository = repositoryCoordinates(payload);
    const runId = workflowRun["id"];
    if (!Number.isSafeInteger(runId) || Number(runId) <= 0) {
      throw new Error("Malformed workflow_run event: workflow_run.id is required");
    }
    const pullRequests = workflowRun["pull_requests"];
    if (!Array.isArray(pullRequests)) throw new Error("Malformed workflow_run event: pull_requests must be an array");
    const canonicalPrNumbers = pullRequests.flatMap((pullRequest) => {
      const record = asRecord(pullRequest);
      const baseRepo = record && asRecord(asRecord(record["base"])?.["repo"]);
      const number = record?.["number"];
      return baseRepo?.["full_name"] === repository.fullName && Number.isSafeInteger(number) && Number(number) > 0
        ? [Number(number)]
        : [];
    });
    if (!deps.configured) {
      await deps.auditLog.append({
        trace_id: traceId,
        actor: "AGT-BLD",
        action: "build_triage_disabled",
        basis: "ADR-0014 / DevOps:SPEC-INT-011",
        detail: { reason: deps.disabledReason ?? "Required build triage dependency is not configured" },
        at: new Date().toISOString(),
      });
      return;
    }

    const evidence = await deps.githubClient.getWorkflowRunFailureLog(repository.owner, repository.repo, Number(runId));
    const agentDeps = { auditLog: deps.auditLog, traceId };
    const classification = await deps.classify(evidence, agentDeps);
    if (classification.classification === "unknown") {
      await deps.auditLog.append({
        trace_id: traceId,
        actor: "AGT-BLD",
        action: "build_triage_skipped",
        basis: "DevOps:SPEC-INT-011",
        detail: { reason: "classification confidence is insufficient", confidence: classification.confidence },
        at: new Date().toISOString(),
      });
      return;
    }

    const suggestion = await deps.generate(classification, deps.repoCheckoutPath, agentDeps);
    const runUrl = typeof workflowRun["html_url"] === "string" ? workflowRun["html_url"] : "unavailable";
    const body = renderBuildResult(classification, suggestion, runUrl);
    if (canonicalPrNumbers.length === 1) {
      await deps.githubClient.createIssueComment({
        owner: repository.owner,
        repo: repository.repo,
        issueOrPrNumber: canonicalPrNumbers[0]!,
        body,
      });
    } else {
      await deps.githubClient.createIssue({
        owner: repository.owner,
        repo: repository.repo,
        title: `[Build failure] workflow run ${runId}`,
        body,
        labels: [],
      });
    }
    await deps.auditLog.append({
      trace_id: traceId,
      actor: "AGT-BLD",
      action: "build_triage_posted",
      basis: "DevOps:REQ-001 / DevOps:REQ-002",
      detail: { destination: canonicalPrNumbers.length === 1 ? "pull_request" : "issue", runId },
      at: new Date().toISOString(),
    });
  };
}

export function createRecencySimilarIncidentsProvider(
  readRecent: RecentTriageReader,
  now: () => Date = () => new Date(),
): SimilarIncidentsProvider {
  return {
    async summarize(): Promise<string> {
      const since = new Date(now().getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const records = (await readRecent({ since, limit: 5 })).slice(0, 5);
      if (records.length === 0) return "No triage audit records in the past 90 days.";
      return records
        .map(
          (record, index) =>
            `${index + 1}. ${record.at} ${sanitizeForLlmInput(JSON.stringify(record.detail)).sanitized.slice(0, 2_000)}`,
        )
        .join("\n");
    },
  };
}

function labelsContainAutoTriaged(issue: Record<string, unknown>): boolean {
  if (!Array.isArray(issue["labels"])) return false;
  return issue["labels"].some((label) =>
    typeof label === "string" ? label === "auto-triaged" : asRecord(label)?.["name"] === "auto-triaged",
  );
}

function isAgentGeneratedIssue(issue: Record<string, unknown>): boolean {
  return (
    labelsContainAutoTriaged(issue) ||
    (typeof issue["body"] === "string" && issue["body"].includes("<!-- aiops-agent:AGT-BLD -->"))
  );
}

function enrichTriageAuditLog(
  auditLog: AuditLogWriter,
  classification: IncidentClassification,
  alertText: string,
): AuditLogWriter {
  const safeProjects = classification.affected_projects.map((project) => sanitizeSecrets(project).sanitized);
  const alertDigest = createHash("sha256").update(sanitizeSecrets(alertText).sanitized).digest("hex");
  return {
    readAll: () => auditLog.readAll(),
    append: (record: Omit<AuditRecord, "log_id">) =>
      auditLog.append(
        record.action === "triage"
          ? {
              ...record,
              detail: {
                ...(asRecord(record.detail) ?? {}),
                alertDigest,
                affected_projects: safeProjects,
                severity: classification.severity_candidate,
              },
            }
          : record,
      ),
  };
}

export function createIncidentEventHandler(deps: IncidentHandlerDeps): DevopsEventHandler {
  return async (event, traceId) => {
    await appendReceipt(deps.auditLog, "AGT-INC", "DevOps:SPEC-INT-030", event.eventName, traceId);
    if (event.eventName !== "issues") return;
    const payload = asRecord(event.payload);
    if (!payload) throw new Error("Malformed issues event payload");
    if (payload["action"] !== "opened") return;
    const issue = asRecord(payload["issue"]);
    if (!issue) throw new Error("Malformed issues event: issue is required");
    if (isAgentGeneratedIssue(issue)) return;

    if (!deps.configured) {
      await deps.auditLog.append({
        trace_id: traceId,
        actor: "AGT-INC",
        action: "incident_triage_disabled",
        basis: "ADR-0014 / DevOps:SPEC-INT-030",
        detail: { reason: deps.disabledReason ?? "Required incident triage dependency is not configured" },
        at: new Date().toISOString(),
      });
      return;
    }
    if (!deps.channel) throw new Error("Incident triage is configured without a Teams channel");

    const repository = repositoryCoordinates(payload);
    const title = issue["title"];
    const body = issue["body"];
    if (typeof title !== "string" || (typeof body !== "string" && body !== null && body !== undefined)) {
      throw new Error("Malformed issues event: issue title/body is invalid");
    }
    const alertText = `${title}\n${typeof body === "string" ? body : ""}`;
    const agentDeps = { auditLog: deps.auditLog, traceId };
    const classification = await deps.classify(
      alertText,
      deps.metricsSnapshot(),
      await deps.similarIncidents.summarize(),
      agentDeps,
    );
    const sanitizedClassification: IncidentClassification = {
      ...classification,
      affected_projects: classification.affected_projects.map((project) => sanitizeSecrets(project).sanitized),
      rationale: sanitizeSecrets(classification.rationale).sanitized,
    };
    await deps.triage(sanitizedClassification, repository.owner, repository.repo, deps.channel, {
      auditLog: enrichTriageAuditLog(deps.auditLog, sanitizedClassification, alertText),
      traceId,
    });
  };
}
