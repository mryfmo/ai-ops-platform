// 根拠: PrjOps:REQ-004/005 / PrjOps:SPEC-INT-030 / FinalArch:ING-001 / ADR-0020
// 永続 claim と preserved contract を束ね、三 channel を同じ deterministic path で処理する。
import { ApplicationFailure, proxyActivities } from "@temporalio/workflow";

import type { VersionedPayload } from "../contracts/index.js";
import { buildIdempotencyKey } from "../lib/idempotency.js";
import {
  assertStatusIngestRequest,
  buildStatusIngestSourceKey,
  buildStatusIngestThreadKey,
  buildStatusIngestWorkflowId,
  deriveStatusIngestDecision,
  parseOptionalStatusIngestSideEffectReceipt,
  parseStatusIngestClaimReceipt,
  parseStatusIngestCompletionReceipt,
  parseStatusIngestSideEffectReceipt,
  parseStatusIngestThreadReceipt,
  type StatusIngestAction,
  type StatusIngestRequest,
  type StatusIngestSideEffectReceipt,
} from "../lib/statusIngestState.js";
import { toTemporalRetryPolicy } from "../lib/retryPolicies.js";
import { ExternalSideEffectUnresolvedError, runExternalSideEffect } from "./sideEffect.js";

export { buildStatusIngestWorkflowId } from "../lib/statusIngestState.js";

interface ThreadQuery {
  readonly threadKey: string;
}

interface ClaimInput {
  readonly event: StatusIngestRequest["event"];
  readonly completeness: ReturnType<typeof deriveStatusIngestDecision>["completeness"];
}

interface SideEffectInput {
  readonly sourceKey: string;
  readonly action: StatusIngestAction;
  readonly event: StatusIngestRequest["event"];
  readonly message: string | null;
}

interface CompletionInput {
  readonly sourceKey: string;
  readonly expectedRevision: number;
  readonly canonicalReference: string | null;
  readonly notificationReference: string;
}

interface AuditInput {
  readonly sourceKey: string;
  readonly threadKey: string;
  readonly code: string;
  readonly action: StatusIngestAction;
  readonly duplicate: boolean;
  readonly clarifyCount: number;
}

export interface StatusIngestActivities {
  readStatusIngestThread(input: VersionedPayload<ThreadQuery>): Promise<unknown>;
  claimStatusIngest(input: VersionedPayload<ClaimInput>): Promise<unknown>;
  findStatusIngestSideEffect(input: VersionedPayload<{ sourceKey: string }>, idempotencyKey: string): Promise<unknown>;
  persistCanonicalStatusUpdate(input: VersionedPayload<SideEffectInput>, idempotencyKey: string): Promise<unknown>;
  sendStatusIngestNotification(input: VersionedPayload<SideEffectInput>, idempotencyKey: string): Promise<unknown>;
  appendStatusIngestAudit(input: VersionedPayload<AuditInput>, idempotencyKey: string): Promise<unknown>;
  completeStatusIngest(input: VersionedPayload<CompletionInput>): Promise<unknown>;
}

export interface StatusIngestResult {
  readonly workflowId: string;
  readonly sourceKey: string;
  readonly threadKey: string;
  readonly outcome: "accepted" | "clarified" | "escalated" | "duplicate" | "shadowed";
  readonly action: StatusIngestAction;
  readonly clarifyCount: number;
  readonly duplicate: boolean;
  readonly missingFields: readonly string[];
}

const reads = proxyActivities<Pick<StatusIngestActivities, "readStatusIngestThread" | "findStatusIngestSideEffect">>({
  startToCloseTimeout: "60 seconds",
  retry: toTemporalRetryPolicy("read"),
});

const idempotentWrites = proxyActivities<Pick<StatusIngestActivities, "claimStatusIngest" | "completeStatusIngest">>({
  startToCloseTimeout: "60 seconds",
  retry: toTemporalRetryPolicy("idempotent-write"),
});

const externalWrites = proxyActivities<
  Pick<
    StatusIngestActivities,
    "persistCanonicalStatusUpdate" | "sendStatusIngestNotification" | "appendStatusIngestAudit"
  >
>({ startToCloseTimeout: "60 seconds", retry: toTemporalRetryPolicy("external-side-effect") });

function contractFailure(error: unknown): never {
  throw ApplicationFailure.nonRetryable(
    error instanceof Error ? error.message : "invalid status ingest workflow contract",
    "E-CP-CONTRACT",
  );
}

function unresolvedFailure(error: ExternalSideEffectUnresolvedError): never {
  throw ApplicationFailure.nonRetryable(error.message, "E-CP-EXTERNAL-UNRESOLVED");
}

async function effect<TInput extends VersionedPayload<SideEffectInput> | VersionedPayload<AuditInput>>(
  kind: StatusIngestSideEffectReceipt["effect"],
  sourceKey: string,
  idempotencyKey: string,
  input: TInput,
  execute: (input: TInput, idempotencyKey: string) => Promise<unknown>,
): Promise<StatusIngestSideEffectReceipt> {
  const query = { schemaVersion: 1 as const, payload: { sourceKey } };
  try {
    const existing = parseOptionalStatusIngestSideEffectReceipt(
      await reads.findStatusIngestSideEffect(query, idempotencyKey),
      sourceKey,
      idempotencyKey,
      kind,
    );
    if (existing !== null) return existing;
    const outcome = await runExternalSideEffect(
      {
        execute,
        reconcile: async (key) => reads.findStatusIngestSideEffect(query, key),
      },
      input,
      idempotencyKey,
    );
    return parseStatusIngestSideEffectReceipt(outcome.result, sourceKey, idempotencyKey, kind);
  } catch (error) {
    if (error instanceof ExternalSideEffectUnresolvedError) return unresolvedFailure(error);
    return contractFailure(error);
  }
}

function auditInput(
  claim: {
    sourceKey: string;
    threadKey: string;
    action: StatusIngestAction;
    duplicate: boolean;
    clarifyCount: number;
  },
  code: string,
): AuditInput {
  return {
    sourceKey: claim.sourceKey,
    threadKey: claim.threadKey,
    code,
    action: claim.action,
    duplicate: claim.duplicate,
    clarifyCount: claim.clarifyCount,
  };
}

async function audit(workflowId: string, sequence: number, input: AuditInput): Promise<StatusIngestSideEffectReceipt> {
  const key = buildIdempotencyKey(workflowId, "appendStatusIngestAudit", sequence);
  return effect(
    "audit",
    input.sourceKey,
    key,
    { schemaVersion: 1, payload: input },
    externalWrites.appendStatusIngestAudit,
  );
}

function notificationMessage(action: StatusIngestAction, clarificationMessage: string | null): string {
  if (action === "accept") return "status update accepted";
  if (action === "clarify") return clarificationMessage!;
  return "status update incomplete after three clarifications";
}

/** source-message claim → side-effect reconcile → CAS completion の一往復。 */
export async function statusIngestWorkflow(input: unknown): Promise<VersionedPayload<StatusIngestResult>> {
  try {
    assertStatusIngestRequest(input);
  } catch (error) {
    return contractFailure(error);
  }
  const request = input.payload;
  const sourceKey = buildStatusIngestSourceKey(request.event);
  const threadKey = buildStatusIngestThreadKey(request.event);
  const workflowId = buildStatusIngestWorkflowId(request.event);
  const completeness = deriveStatusIngestDecision(request.event.update, 0).completeness;

  if (request.executionMode === "shadow") {
    let clarifyCount: number;
    try {
      clarifyCount = parseStatusIngestThreadReceipt(
        await reads.readStatusIngestThread({ schemaVersion: 1, payload: { threadKey } }),
        threadKey,
      );
    } catch (error) {
      return contractFailure(error);
    }
    const decision = deriveStatusIngestDecision(request.event.update, clarifyCount);
    return {
      schemaVersion: 1,
      payload: {
        workflowId,
        sourceKey,
        threadKey,
        outcome: "shadowed",
        action: decision.action,
        clarifyCount,
        duplicate: false,
        missingFields: decision.completeness.missingFields,
      },
    };
  }

  let claim;
  try {
    claim = parseStatusIngestClaimReceipt(
      await idempotentWrites.claimStatusIngest({
        schemaVersion: 1,
        payload: { event: request.event, completeness },
      }),
      request.event,
      completeness,
    );
  } catch (error) {
    return contractFailure(error);
  }
  const decision = deriveStatusIngestDecision(request.event.update, claim.priorClarifyCount);
  await audit(workflowId, 0, auditInput(claim, "E-ING-RECEIVED"));
  if (claim.duplicate) {
    await audit(workflowId, 1, auditInput(claim, "E-ING-DUPLICATE"));
    if (claim.state === "complete") {
      return {
        schemaVersion: 1,
        payload: {
          workflowId,
          sourceKey,
          threadKey,
          outcome: "duplicate",
          action: claim.action,
          clarifyCount: claim.clarifyCount,
          duplicate: true,
          missingFields: completeness.missingFields,
        },
      };
    }
  }

  let canonicalReference: string | null = null;
  if (claim.action === "accept") {
    const key = buildIdempotencyKey(workflowId, "persistCanonicalStatusUpdate", 0);
    canonicalReference = (
      await effect(
        "canonical",
        sourceKey,
        key,
        { schemaVersion: 1, payload: { sourceKey, action: claim.action, event: request.event, message: null } },
        externalWrites.persistCanonicalStatusUpdate,
      )
    ).reference;
  }
  const notificationKey = buildIdempotencyKey(workflowId, "sendStatusIngestNotification", 0);
  const notificationReference = (
    await effect(
      "notification",
      sourceKey,
      notificationKey,
      {
        schemaVersion: 1,
        payload: {
          sourceKey,
          action: claim.action,
          event: request.event,
          message: notificationMessage(claim.action, decision.clarificationMessage),
        },
      },
      externalWrites.sendStatusIngestNotification,
    )
  ).reference;
  try {
    parseStatusIngestCompletionReceipt(
      await idempotentWrites.completeStatusIngest({
        schemaVersion: 1,
        payload: { sourceKey, expectedRevision: claim.revision, canonicalReference, notificationReference },
      }),
      sourceKey,
      claim.revision,
    );
  } catch (error) {
    return contractFailure(error);
  }

  const terminal =
    claim.action === "accept"
      ? { code: "E-ING-ACCEPTED", outcome: "accepted" as const }
      : claim.action === "clarify"
        ? { code: "E-ING-CLARIFIED", outcome: "clarified" as const }
        : { code: "E-ING-ESCALATED", outcome: "escalated" as const };
  await audit(workflowId, 2, auditInput(claim, terminal.code));
  return {
    schemaVersion: 1,
    payload: {
      workflowId,
      sourceKey,
      threadKey,
      outcome: terminal.outcome,
      action: claim.action,
      clarifyCount: claim.clarifyCount,
      duplicate: claim.duplicate,
      missingFields: completeness.missingFields,
    },
  };
}
