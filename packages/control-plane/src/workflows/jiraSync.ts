// 根拠: 添付TEXT「Jira・GitHub・ai-ops-platform構成」 / TMP-003 / ADR-0020
// JiraSyncWorkflow。Jira は運用作業の正本、GitHub は開発・正式記録の正本、
// ai-ops-platform は認可・承認・冪等性・監査・reconcile の正本として分離する。
// 既存 Plane workflow は Temporal replay 互換のため削除・改名しない。

import { ApplicationFailure, executeChild, proxyActivities } from "@temporalio/workflow";

import type { VersionedPayload } from "../contracts/index.js";
import { buildIdempotencyKey } from "../lib/idempotency.js";
import {
  assertJiraSyncRequest,
  parseJiraBaselineReceipt,
  parseJiraPromotionEligibility,
  parseJiraPromotionLedgerStatus,
  parseJiraPromotionWriteResult,
  parseJiraSyncLedgerStatus,
  parseJiraSyncWriteReceipt,
  parseJiraTransitionAuthorization,
  parseJiraTransitionLedgerStatus,
  parseJiraTransitionWriteResult,
  sameJiraIssueBaseline,
  type JiraIssueBaseline,
  type JiraSyncIdentity,
  type JiraSyncOperation,
  type JiraSyncRequest,
} from "../lib/jiraSyncState.js";
import { toTemporalRetryPolicy } from "../lib/retryPolicies.js";
import { ExternalSideEffectUnresolvedError, runExternalSideEffect } from "./sideEffect.js";

export interface JiraSyncActivities {
  /** 内部 ledger の三値 read。pending は成功でも不在でもない。 */
  findJiraSyncWrite(
    input: VersionedPayload<{ identity: JiraSyncIdentity; operation: JiraSyncOperation }>,
    idempotencyKey: string,
  ): Promise<unknown>;
  /** GitHub Branch/Commit/PR/Build/Deployment の最小 Development Information を Jira へ投影。 */
  projectDevelopmentToJira(
    input: VersionedPayload<{ identity: JiraSyncIdentity; origin: JiraSyncRequest["origin"] }>,
    idempotencyKey: string,
  ): Promise<unknown>;
  /** 認証・mapping 検証済みの最小 Jira metadata event を内部 event store へ記録。 */
  emitJiraEvent(
    input: VersionedPayload<{ identity: JiraSyncIdentity; origin: JiraSyncRequest["origin"] }>,
    idempotencyKey: string,
  ): Promise<unknown>;
  /** engineering-ready / human approval / baseline の authoritative read。 */
  readJiraPromotionEligibility(
    input: VersionedPayload<{ identity: JiraSyncIdentity; approvalId: string }>,
  ): Promise<unknown>;
  /** updated + statusId + fieldHash の現行 baseline read。 */
  readJiraIssueBaseline(input: VersionedPayload<{ identity: JiraSyncIdentity }>): Promise<unknown>;
  /** CAS 成立時だけ GitHub Draft PR を作成する。Approve/Merge は実装不可。 */
  createJiraPromotionDraft(
    input: VersionedPayload<{
      identity: JiraSyncIdentity;
      approvalId: string;
      baseline: JiraIssueBaseline;
    }>,
    idempotencyKey: string,
  ): Promise<unknown>;
  /** protected status 遷移の policy + approval + baseline authoritative read。 */
  readJiraTransitionAuthorization(
    input: VersionedPayload<{ identity: JiraSyncIdentity; approvalId: string; targetStatusId: string }>,
  ): Promise<unknown>;
  /** CAS 成立時だけ Jira status を遷移する one-shot write。 */
  transitionJiraStatus(
    input: VersionedPayload<{
      identity: JiraSyncIdentity;
      approvalId: string;
      targetStatusId: string;
      baseline: JiraIssueBaseline;
    }>,
    idempotencyKey: string,
  ): Promise<unknown>;
}

export type JiraChildOutcome =
  | {
      readonly operation: "projection" | "event";
      readonly outcome: "executed" | "reconciled" | "shadowed";
    }
  | {
      readonly operation: "promotion";
      readonly outcome: "executed" | "reconciled" | "shadowed" | "stale" | "not-eligible";
    }
  | {
      readonly operation: "transition";
      readonly outcome: "executed" | "reconciled" | "shadowed" | "stale" | "not-authorized";
    };

export interface JiraSyncResult {
  readonly workflowId: string;
  readonly identity: JiraSyncIdentity;
  readonly origin: JiraSyncRequest["origin"];
  readonly phase: "complete" | "shadowed";
  readonly outcomes: readonly JiraChildOutcome[];
}

const reads = proxyActivities<
  Pick<
    JiraSyncActivities,
    "findJiraSyncWrite" | "readJiraPromotionEligibility" | "readJiraIssueBaseline" | "readJiraTransitionAuthorization"
  >
>({ startToCloseTimeout: "60 seconds", retry: toTemporalRetryPolicy("read") });

const externalWrites = proxyActivities<
  Pick<
    JiraSyncActivities,
    "projectDevelopmentToJira" | "emitJiraEvent" | "createJiraPromotionDraft" | "transitionJiraStatus"
  >
>({ startToCloseTimeout: "60 seconds", retry: toTemporalRetryPolicy("external-side-effect") });

function contractFailure(error: unknown): never {
  throw ApplicationFailure.nonRetryable(
    error instanceof Error ? error.message : "invalid Jira sync workflow contract",
    "E-CP-CONTRACT",
  );
}

function unresolvedFailure(message: string): never {
  throw ApplicationFailure.nonRetryable(message, "E-CP-EXTERNAL-UNRESOLVED");
}

function identityKey(identity: JiraSyncIdentity): string {
  return `${identity.issueKey}:${identity.projectId}:${String(identity.mappingVersion)}:${identity.revision}`;
}

/** v1 public workflow enum is left unchanged; Jira sync is an internal Temporal queue/workflow. */
export function buildJiraSyncWorkflowId(
  identity: JiraSyncIdentity,
  operation?: JiraSyncOperation,
  approvalId?: string,
  targetStatusId?: string,
): string {
  const suffix = [operation, approvalId, targetStatusId]
    .filter((value): value is string => value !== undefined)
    .join(":");
  const businessKey = `${identityKey(identity)}${suffix ? `:${suffix}` : ""}`;
  if (businessKey.length > 500 || businessKey.includes("/")) {
    throw new RangeError("Jira workflow business key is invalid or too long");
  }
  return `jira-sync/${businessKey}`;
}

function assertChildRequest(input: unknown): asserts input is VersionedPayload<JiraSyncRequest> {
  // child は直接起動可能な trust boundary。親と同じ完全検証を通す。
  assertJiraSyncRequest(input);
}

async function runDedupedWrite(
  operation: "projection" | "event",
  request: JiraSyncRequest,
  write: (
    input: VersionedPayload<{ identity: JiraSyncIdentity; origin: JiraSyncRequest["origin"] }>,
    key: string,
  ) => Promise<unknown>,
): Promise<"executed" | "reconciled" | "shadowed"> {
  const identity: JiraSyncIdentity = {
    issueKey: request.issueKey,
    projectId: request.projectId,
    mappingVersion: request.mappingVersion,
    revision: request.revision,
  };
  let idempotencyKey: string;
  try {
    idempotencyKey = buildIdempotencyKey(buildJiraSyncWorkflowId(identity, operation), "jiraSyncWrite", 0);
  } catch (error) {
    return contractFailure(error);
  }
  const ledgerInput: VersionedPayload<{ identity: JiraSyncIdentity; operation: JiraSyncOperation }> = {
    schemaVersion: 1,
    payload: { identity, operation },
  };

  const preflightRaw = await reads.findJiraSyncWrite(ledgerInput, idempotencyKey);
  let preflight;
  try {
    preflight = parseJiraSyncLedgerStatus(preflightRaw, identity, operation, idempotencyKey);
  } catch (error) {
    return contractFailure(error);
  }
  if (preflight.status === "written") return "reconciled";
  if (preflight.status === "pending") {
    return unresolvedFailure(
      `Jira sync ledger is pending for ${operation}/${identityKey(identity)}; automatic redispatch is forbidden`,
    );
  }
  if (request.executionMode === "shadow") return "shadowed";

  try {
    const outcome = await runExternalSideEffect(
      {
        execute: async (_input, key) => write({ schemaVersion: 1, payload: { identity, origin: request.origin } }, key),
        reconcile: async (key) => {
          const raw = await reads.findJiraSyncWrite(ledgerInput, key);
          let status;
          try {
            status = parseJiraSyncLedgerStatus(raw, identity, operation, key);
          } catch (error) {
            return contractFailure(error);
          }
          return status.status === "written" ? status.receipt : null;
        },
      },
      { identity },
      idempotencyKey,
    );
    try {
      parseJiraSyncWriteReceipt(
        outcome.outcome === "reconciled" ? { schemaVersion: 1, payload: outcome.result } : outcome.result,
        identity,
        operation,
        idempotencyKey,
      );
    } catch (error) {
      return contractFailure(error);
    }
    return outcome.outcome;
  } catch (error) {
    if (error instanceof ExternalSideEffectUnresolvedError) return unresolvedFailure(error.message);
    throw error;
  }
}

export async function jiraProjectionWorkflow(input: unknown): Promise<VersionedPayload<JiraChildOutcome>> {
  try {
    assertChildRequest(input);
  } catch (error) {
    return contractFailure(error);
  }
  const outcome = await runDedupedWrite("projection", input.payload, (writeInput, key) =>
    externalWrites.projectDevelopmentToJira(writeInput, key),
  );
  return { schemaVersion: 1, payload: { operation: "projection", outcome } };
}

export async function jiraEventWorkflow(input: unknown): Promise<VersionedPayload<JiraChildOutcome>> {
  try {
    assertChildRequest(input);
  } catch (error) {
    return contractFailure(error);
  }
  const outcome = await runDedupedWrite("event", input.payload, (writeInput, key) =>
    externalWrites.emitJiraEvent(writeInput, key),
  );
  return { schemaVersion: 1, payload: { operation: "event", outcome } };
}

export async function jiraPromotionWorkflow(input: unknown): Promise<VersionedPayload<JiraChildOutcome>> {
  try {
    assertChildRequest(input);
  } catch (error) {
    return contractFailure(error);
  }
  const request = input.payload;
  const approvalId = request.approvalId!;
  const identity: JiraSyncIdentity = {
    issueKey: request.issueKey,
    projectId: request.projectId,
    mappingVersion: request.mappingVersion,
    revision: request.revision,
  };
  const eligibilityRaw = await reads.readJiraPromotionEligibility({
    schemaVersion: 1,
    payload: { identity, approvalId },
  });
  let eligibility;
  try {
    eligibility = parseJiraPromotionEligibility(eligibilityRaw, identity, approvalId);
  } catch (error) {
    return contractFailure(error);
  }
  if (!eligibility.engineeringReady || !eligibility.approved) {
    return { schemaVersion: 1, payload: { operation: "promotion", outcome: "not-eligible" } };
  }

  let idempotencyKey: string;
  try {
    idempotencyKey = buildIdempotencyKey(
      buildJiraSyncWorkflowId(identity, "promotion", approvalId),
      "createJiraPromotionDraft",
      0,
    );
  } catch (error) {
    return contractFailure(error);
  }
  const ledgerInput: VersionedPayload<{ identity: JiraSyncIdentity; operation: JiraSyncOperation }> = {
    schemaVersion: 1,
    payload: { identity, operation: "promotion" },
  };
  const preflightRaw = await reads.findJiraSyncWrite(ledgerInput, idempotencyKey);
  let preflight;
  try {
    preflight = parseJiraPromotionLedgerStatus(preflightRaw, identity, idempotencyKey, approvalId, null);
  } catch (error) {
    return contractFailure(error);
  }
  if (preflight.status === "written") {
    return { schemaVersion: 1, payload: { operation: "promotion", outcome: "reconciled" } };
  }
  if (preflight.status === "pending") {
    return unresolvedFailure(
      `Jira promotion ledger is pending for ${identityKey(identity)}; manual reconcile required`,
    );
  }
  if (request.executionMode === "shadow") {
    return { schemaVersion: 1, payload: { operation: "promotion", outcome: "shadowed" } };
  }

  const baselineRaw = await reads.readJiraIssueBaseline({ schemaVersion: 1, payload: { identity } });
  let currentBaseline;
  try {
    currentBaseline = parseJiraBaselineReceipt(baselineRaw, identity);
  } catch (error) {
    return contractFailure(error);
  }
  if (!sameJiraIssueBaseline(currentBaseline, eligibility.baseline)) {
    return { schemaVersion: 1, payload: { operation: "promotion", outcome: "stale" } };
  }

  try {
    const outcome = await runExternalSideEffect(
      {
        execute: async (_input, key) =>
          externalWrites.createJiraPromotionDraft(
            { schemaVersion: 1, payload: { identity, approvalId, baseline: eligibility.baseline } },
            key,
          ),
        reconcile: async (key) => {
          const raw = await reads.findJiraSyncWrite(ledgerInput, key);
          let status;
          try {
            status = parseJiraPromotionLedgerStatus(raw, identity, key, approvalId, eligibility.baseline);
          } catch (error) {
            return contractFailure(error);
          }
          return status.status === "written" ? status.receipt : null;
        },
      },
      { identity },
      idempotencyKey,
    );
    if (outcome.outcome === "executed") {
      let result;
      try {
        result = parseJiraPromotionWriteResult(
          outcome.result,
          identity,
          idempotencyKey,
          approvalId,
          eligibility.baseline,
        );
      } catch (error) {
        return contractFailure(error);
      }
      if (result.kind === "stale") {
        return { schemaVersion: 1, payload: { operation: "promotion", outcome: "stale" } };
      }
    }
    return { schemaVersion: 1, payload: { operation: "promotion", outcome: outcome.outcome } };
  } catch (error) {
    if (error instanceof ExternalSideEffectUnresolvedError) return unresolvedFailure(error.message);
    throw error;
  }
}

export async function jiraTransitionWorkflow(input: unknown): Promise<VersionedPayload<JiraChildOutcome>> {
  try {
    assertChildRequest(input);
  } catch (error) {
    return contractFailure(error);
  }
  const request = input.payload;
  const approvalId = request.approvalId!;
  const targetStatusId = request.targetStatusId!;
  const identity: JiraSyncIdentity = {
    issueKey: request.issueKey,
    projectId: request.projectId,
    mappingVersion: request.mappingVersion,
    revision: request.revision,
  };
  const authorizationRaw = await reads.readJiraTransitionAuthorization({
    schemaVersion: 1,
    payload: { identity, approvalId, targetStatusId },
  });
  let authorization;
  try {
    authorization = parseJiraTransitionAuthorization(authorizationRaw, identity, approvalId, targetStatusId);
  } catch (error) {
    return contractFailure(error);
  }
  if (!authorization.approved) {
    return { schemaVersion: 1, payload: { operation: "transition", outcome: "not-authorized" } };
  }

  let idempotencyKey: string;
  try {
    idempotencyKey = buildIdempotencyKey(
      buildJiraSyncWorkflowId(identity, "transition", approvalId, targetStatusId),
      "transitionJiraStatus",
      0,
    );
  } catch (error) {
    return contractFailure(error);
  }
  const ledgerInput: VersionedPayload<{ identity: JiraSyncIdentity; operation: JiraSyncOperation }> = {
    schemaVersion: 1,
    payload: { identity, operation: "transition" },
  };
  const preflightRaw = await reads.findJiraSyncWrite(ledgerInput, idempotencyKey);
  let preflight;
  try {
    preflight = parseJiraTransitionLedgerStatus(
      preflightRaw,
      identity,
      idempotencyKey,
      approvalId,
      targetStatusId,
      authorization.baseline,
    );
  } catch (error) {
    return contractFailure(error);
  }
  if (preflight.status === "written") {
    return { schemaVersion: 1, payload: { operation: "transition", outcome: "reconciled" } };
  }
  if (preflight.status === "pending") {
    return unresolvedFailure(
      `Jira transition ledger is pending for ${identityKey(identity)}; manual reconcile required`,
    );
  }
  if (request.executionMode === "shadow") {
    return { schemaVersion: 1, payload: { operation: "transition", outcome: "shadowed" } };
  }

  const baselineRaw = await reads.readJiraIssueBaseline({ schemaVersion: 1, payload: { identity } });
  let currentBaseline;
  try {
    currentBaseline = parseJiraBaselineReceipt(baselineRaw, identity);
  } catch (error) {
    return contractFailure(error);
  }
  if (!sameJiraIssueBaseline(currentBaseline, authorization.baseline)) {
    return { schemaVersion: 1, payload: { operation: "transition", outcome: "stale" } };
  }

  try {
    const outcome = await runExternalSideEffect(
      {
        execute: async (_input, key) =>
          externalWrites.transitionJiraStatus(
            {
              schemaVersion: 1,
              payload: { identity, approvalId, targetStatusId, baseline: authorization.baseline },
            },
            key,
          ),
        reconcile: async (key) => {
          const raw = await reads.findJiraSyncWrite(ledgerInput, key);
          let status;
          try {
            status = parseJiraTransitionLedgerStatus(
              raw,
              identity,
              key,
              approvalId,
              targetStatusId,
              authorization.baseline,
            );
          } catch (error) {
            return contractFailure(error);
          }
          return status.status === "written" ? status.receipt : null;
        },
      },
      { identity },
      idempotencyKey,
    );
    if (outcome.outcome === "executed") {
      let result;
      try {
        result = parseJiraTransitionWriteResult(
          outcome.result,
          identity,
          idempotencyKey,
          approvalId,
          targetStatusId,
          authorization.baseline,
        );
      } catch (error) {
        return contractFailure(error);
      }
      if (result.kind === "stale") {
        return { schemaVersion: 1, payload: { operation: "transition", outcome: "stale" } };
      }
    }
    return { schemaVersion: 1, payload: { operation: "transition", outcome: outcome.outcome } };
  } catch (error) {
    if (error instanceof ExternalSideEffectUnresolvedError) return unresolvedFailure(error.message);
    throw error;
  }
}

export async function jiraSyncWorkflow(input: unknown): Promise<VersionedPayload<JiraSyncResult>> {
  try {
    assertJiraSyncRequest(input);
  } catch (error) {
    return contractFailure(error);
  }
  const request = input.payload;
  const identity: JiraSyncIdentity = {
    issueKey: request.issueKey,
    projectId: request.projectId,
    mappingVersion: request.mappingVersion,
    revision: request.revision,
  };
  let workflowId: string;
  try {
    workflowId = buildJiraSyncWorkflowId(identity);
  } catch (error) {
    return contractFailure(error);
  }

  const outcomes: JiraChildOutcome[] = [];
  for (const operation of request.operations) {
    const child =
      operation === "projection"
        ? jiraProjectionWorkflow
        : operation === "event"
          ? jiraEventWorkflow
          : operation === "promotion"
            ? jiraPromotionWorkflow
            : jiraTransitionWorkflow;
    const result = await executeChild(child, {
      workflowId: `${workflowId}/${operation}`,
      args: [input],
    });
    outcomes.push(result.payload);
  }

  return {
    schemaVersion: 1,
    payload: {
      workflowId,
      identity,
      origin: request.origin,
      phase: request.executionMode === "shadow" ? "shadowed" : "complete",
      outcomes,
    },
  };
}
