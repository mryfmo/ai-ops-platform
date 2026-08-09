/**
 * packages/server/src/agents/devopsEventHandlers.ts
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
import type { ClassificationResult, IncidentClassification, Th001Input } from "@aiops/devops";
import type { DevopsEventHandler } from "../lib/githubEventRouter.js";

/** A045 ingress contract: only GitHub issues opened with this label are monitoring/external-contact alerts. */
export const ALERT_LABEL = "alert";

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
  repoCheckoutPathFor(repositoryFullName: string): string | null;
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
  deps: {
    auditLog: AuditLogWriter;
    traceId: string;
    sourceIssueMarker: string;
    existingIssue: ExistingIncidentIssue | null;
  },
) => Promise<{ issueUrl: string; effectiveSeverity: string }>;

export interface ExistingIncidentIssue {
  number: number;
  htmlUrl: string;
}

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
  findExistingIssue(owner: string, repo: string, marker: string): Promise<ExistingIncidentIssue | null>;
  auditLog: AuditLogWriter;
  classify: IncidentClassifier;
  triage: IncidentTriage;
}

export interface CoverageEvidence {
  commitSha: string;
  unitTestCoveragePct: number;
}

export function parseCoverageEvidence(value: unknown): CoverageEvidence | null {
  const record = asRecord(value);
  if (
    record?.["schemaVersion"] !== 1 ||
    typeof record["commitSha"] !== "string" ||
    !/^[0-9a-f]{40}$/.test(record["commitSha"]) ||
    typeof record["unitTestCoveragePct"] !== "number" ||
    !Number.isFinite(record["unitTestCoveragePct"]) ||
    record["unitTestCoveragePct"] < 0 ||
    record["unitTestCoveragePct"] > 100
  ) {
    return null;
  }
  return { commitSha: record["commitSha"], unitTestCoveragePct: record["unitTestCoveragePct"] };
}

export interface DeployHandlerDeps {
  configured: boolean;
  disabledReason?: string;
  channel?: ChannelRef;
  coverageEvidence: {
    read(owner: string, repo: string, runId: number): Promise<CoverageEvidence | null>;
  };
  /** D-16 seam: unavailable is `null`, never an inferred zero. */
  criticalCountEvidence: {
    read(owner: string, repo: string, runId: number): Promise<number | null>;
  };
  deploymentState?: {
    markMonitoring(owner: string, repo: string, commitSha: string): Promise<boolean>;
    markWorkflowFailed(owner: string, repo: string, commitSha: string): Promise<boolean>;
  };
  auditLog: AuditLogWriter;
  promote(input: Th001Input, channel: ChannelRef, commitShaShort: string, traceId: string): Promise<boolean>;
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
  actor: "AGT-BLD" | "AGT-DEP" | "AGT-INC",
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

/** DevOps:REQ-003 / TH-001: successful workflow_run evidence is complete-or-no-promotion. */
export function createDeployEventHandler(deps: DeployHandlerDeps): DevopsEventHandler {
  return async (event, traceId) => {
    await appendReceipt(deps.auditLog, "AGT-DEP", "DevOps:REQ-003/TH-001", event.eventName, traceId);
    if (event.eventName !== "workflow_run") return;
    const payload = asRecord(event.payload);
    const workflowRun = payload && asRecord(payload["workflow_run"]);
    if (!payload || !workflowRun) throw new Error("Malformed workflow_run event payload");
    if (payload["action"] !== "completed") return;
    const repository = repositoryCoordinates(payload);
    const runId = workflowRun["id"];
    const headSha = workflowRun["head_sha"];
    if (
      !Number.isSafeInteger(runId) ||
      Number(runId) <= 0 ||
      typeof headSha !== "string" ||
      !/^[0-9a-f]{40}$/.test(headSha)
    ) {
      throw new Error("Malformed workflow_run event: id and canonical head_sha are required");
    }
    const workflowPath = workflowRun["path"];
    if (typeof workflowPath === "string" && /(^|\/)deploy-prod\.yml(?:@|$)/.test(workflowPath)) {
      const succeeded = workflowRun["conclusion"] === "success";
      const transitioned =
        (await (succeeded
          ? deps.deploymentState?.markMonitoring(repository.owner, repository.repo, headSha)
          : deps.deploymentState?.markWorkflowFailed(repository.owner, repository.repo, headSha))) ?? false;
      await deps.auditLog.append({
        trace_id: traceId,
        actor: "AGT-DEP",
        action: transitioned
          ? succeeded
            ? "prod_deploy_monitoring"
            : "prod_deploy_failed"
          : "prod_deploy_state_unmatched",
        basis: "DevOps:SPEC-INT-020 / DevOps:REQ-012",
        detail: { commitSha: headSha },
        at: new Date().toISOString(),
      });
      return;
    }
    if (workflowRun["conclusion"] !== "success") return;
    if (!deps.configured || !deps.channel) {
      await deps.auditLog.append({
        trace_id: traceId,
        actor: "AGT-DEP",
        action: "staging_promotion_disabled",
        basis: "ADR-0014 / DevOps:REQ-003 / TH-001",
        detail: { reason: deps.disabledReason ?? "Default Teams channel is not configured" },
        at: new Date().toISOString(),
      });
      return;
    }
    const [coverage, criticalCount] = await Promise.all([
      deps.coverageEvidence.read(repository.owner, repository.repo, Number(runId)),
      deps.criticalCountEvidence.read(repository.owner, repository.repo, Number(runId)),
    ]);
    const validCoverage =
      coverage !== null &&
      coverage.commitSha === headSha &&
      Number.isFinite(coverage.unitTestCoveragePct) &&
      coverage.unitTestCoveragePct >= 0 &&
      coverage.unitTestCoveragePct <= 100;
    const validCriticalCount = criticalCount !== null && Number.isSafeInteger(criticalCount) && criticalCount >= 0;
    if (!validCoverage || !validCriticalCount) {
      await deps.auditLog.append({
        trace_id: traceId,
        actor: "AGT-DEP",
        action: "staging_promotion_input_missing",
        basis: "DevOps:REQ-003 / TH-001 / D-16",
        detail: {
          coverageAvailable: validCoverage,
          criticalCountAvailable: validCriticalCount,
          coverageCommitMatches: coverage?.commitSha === headSha,
        },
        at: new Date().toISOString(),
      });
      return;
    }
    const promoted = await deps.promote(
      {
        ciAllJobsSuccess: true,
        unitTestCoveragePct: coverage.unitTestCoveragePct,
        staticAnalysisCriticalCount: criticalCount,
      },
      deps.channel,
      headSha.slice(0, 7),
      traceId,
    );
    if (!promoted) {
      await deps.auditLog.append({
        trace_id: traceId,
        actor: "AGT-DEP",
        action: "staging_promotion_not_eligible",
        basis: "DevOps:REQ-003 / TH-001",
        detail: { commitSha: headSha },
        at: new Date().toISOString(),
      });
    }
  };
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

    const needsFixSuggestion =
      classification.classification === "test_failure" || classification.classification === "compile_error";
    const repoCheckoutPath = deps.repoCheckoutPathFor(repository.fullName);
    let suggestion: string | null = null;
    if (needsFixSuggestion && !repoCheckoutPath) {
      await deps.auditLog.append({
        trace_id: traceId,
        actor: "AGT-BLD",
        action: "build_fix_suggestion_disabled",
        basis: "ADR-0014 / DevOps:REQ-002",
        detail: { reason: "No explicit local checkout mapping exists for the event repository" },
        at: new Date().toISOString(),
      });
    } else if (repoCheckoutPath) {
      suggestion = await deps.generate(classification, repoCheckoutPath, agentDeps);
    }
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

function hasIssueLabel(issue: Record<string, unknown>, expected: string): boolean {
  if (!Array.isArray(issue["labels"])) return false;
  return issue["labels"].some((label) =>
    typeof label === "string" ? label === expected : asRecord(label)?.["name"] === expected,
  );
}

function isAgentGeneratedIssue(issue: Record<string, unknown>): boolean {
  return (
    hasIssueLabel(issue, "auto-triaged") ||
    (typeof issue["body"] === "string" && issue["body"].includes("<!-- aiops-agent:AGT-BLD -->"))
  );
}

function enrichTriageAuditLog(
  auditLog: AuditLogWriter,
  classification: IncidentClassification,
  alertText: string,
  sourceIssueMarker: string,
  deduplicated: boolean,
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
                sourceIssueMarker,
                deduplicated,
              },
            }
          : record,
      ),
  };
}

export function createIncidentIssueClient(
  githubClient: { createIssue(input: CreateIssueInput): Promise<ExistingIncidentIssue> },
  sourceIssueMarker: string,
  existingIssue: ExistingIncidentIssue | null,
): { createIssue(input: CreateIssueInput): Promise<ExistingIncidentIssue> } {
  return {
    createIssue: (input) =>
      existingIssue
        ? Promise.resolve(existingIssue)
        : githubClient.createIssue({ ...input, body: `${input.body}\n\n<!-- ${sourceIssueMarker} -->` }),
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
    if (!hasIssueLabel(issue, ALERT_LABEL)) return;

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
    const issueNumber = issue["number"];
    if (!Number.isSafeInteger(issueNumber) || Number(issueNumber) <= 0) {
      throw new Error("Malformed issues event: issue.number is required for retry dedupe");
    }
    const sourceIssueMarker = `source-issue:${Number(issueNumber)}`;
    const title = issue["title"];
    const body = issue["body"];
    if (typeof title !== "string" || (typeof body !== "string" && body !== null && body !== undefined)) {
      throw new Error("Malformed issues event: issue title/body is invalid");
    }
    const existingIssue = await deps.findExistingIssue(repository.owner, repository.repo, sourceIssueMarker);
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
      auditLog: enrichTriageAuditLog(
        deps.auditLog,
        sanitizedClassification,
        alertText,
        sourceIssueMarker,
        existingIssue !== null,
      ),
      traceId,
      sourceIssueMarker,
      existingIssue,
    });
  };
}
