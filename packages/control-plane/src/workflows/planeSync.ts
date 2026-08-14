// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / FinalArch:CON-002 / TMP-003 / ADR-0020 / ADR-0023
// PlaneSyncWorkflow（正典 component spec 01/08）。projection / event / promotion を
// 別 child workflow に分離し、親は順序と結果集約のみを担う。
// - dedupe 恒等 = (external_source, external_id, project_id, mapping_version)
// - unknown write result は reconcile（三値 ledger。pending は自動再送も成功回収もしない）
// - promotion は authoritative eligibility read で baseline revision を固定し、
//   draft 作成直前に現行 revision を再読して不一致なら write なしの stale 終端。
//   receipt は baseline echo + draft:true を束縛（operationBoundary の draft 境界）。

import { ApplicationFailure, executeChild, proxyActivities } from "@temporalio/workflow";

import type { VersionedPayload } from "../contracts/index.js";
import { buildIdempotencyKey } from "../lib/idempotency.js";
import {
  assertPlaneSyncRequest,
  parsePlanePromotionDraftReceipt,
  parsePlanePromotionEligibility,
  parsePlaneRevisionReceipt,
  parsePlaneSyncLedgerStatus,
  parsePlaneSyncWriteReceipt,
  type PlaneSyncIdentity,
  type PlaneSyncOperation,
  type PlaneSyncRequest,
} from "../lib/planeSyncState.js";
import { toTemporalRetryPolicy } from "../lib/retryPolicies.js";
import { buildWorkflowId } from "../lib/workflowId.js";
import { ExternalSideEffectUnresolvedError, runExternalSideEffect } from "./sideEffect.js";

export interface PlaneSyncActivities {
  /** 内部 sync 台帳（正本）の三値 read: null=absent / pending / written。 */
  findPlaneSyncWrite(
    input: VersionedPayload<{ identity: PlaneSyncIdentity; operation: PlaneSyncOperation }>,
    idempotencyKey: string,
  ): Promise<unknown>;
  /**
   * GitHub → Plane projection（非冪等 write）。実装契約: state summary +
   * canonical link のみを投影し、operationBoundary（plane: read+draft）内で行う。
   */
  projectToPlane(input: VersionedPayload<{ identity: PlaneSyncIdentity }>, idempotencyKey: string): Promise<unknown>;
  /** Plane → platform event の記録（非冪等 write、内部 event store）。 */
  emitPlaneEvent(input: VersionedPayload<{ identity: PlaneSyncIdentity }>, idempotencyKey: string): Promise<unknown>;
  /** promotion 適格性の authoritative read（engineering-ready / approved / baseline）。 */
  readPromotionEligibility(input: VersionedPayload<{ identity: PlaneSyncIdentity }>): Promise<unknown>;
  /** 現行 work item revision の read（stale check 用）。 */
  readWorkItemRevision(input: VersionedPayload<{ identity: PlaneSyncIdentity }>): Promise<unknown>;
  /**
   * Plane → GitHub promotion（非冪等 write）。実装契約: baseline revision を
   * 入力どおり固定した draft PR/Issue の作成まで。merge・formal publish は
   * platform protection / 人間の管轄で、この activity から到達不能であること。
   */
  createPromotionDraft(
    input: VersionedPayload<{ identity: PlaneSyncIdentity; baselineRevision: string }>,
    idempotencyKey: string,
  ): Promise<unknown>;
}

export type PlaneChildOutcome =
  | { readonly operation: PlaneSyncOperation; readonly outcome: "executed" | "reconciled" | "shadowed" }
  | { readonly operation: "promotion"; readonly outcome: "stale" | "not-eligible" };

export interface PlaneSyncResult {
  readonly workflowId: string;
  readonly identity: PlaneSyncIdentity;
  readonly phase: "complete" | "shadowed";
  readonly outcomes: readonly PlaneChildOutcome[];
}

const reads = proxyActivities<
  Pick<PlaneSyncActivities, "findPlaneSyncWrite" | "readPromotionEligibility" | "readWorkItemRevision">
>({ startToCloseTimeout: "60 seconds", retry: toTemporalRetryPolicy("read") });

const externalWrites = proxyActivities<
  Pick<PlaneSyncActivities, "projectToPlane" | "emitPlaneEvent" | "createPromotionDraft">
>({ startToCloseTimeout: "60 seconds", retry: toTemporalRetryPolicy("external-side-effect") });

function contractFailure(error: unknown): never {
  throw ApplicationFailure.nonRetryable(
    error instanceof Error ? error.message : "invalid plane sync workflow contract",
    "E-CP-CONTRACT",
  );
}

function unresolvedFailure(message: string): never {
  throw ApplicationFailure.nonRetryable(message, "E-CP-EXTERNAL-UNRESOLVED");
}

function identityKey(identity: PlaneSyncIdentity): string {
  return `${identity.externalSource}:${identity.externalId}:${identity.projectId}:${String(identity.mappingVersion)}`;
}

export function buildPlaneSyncWorkflowId(identity: PlaneSyncIdentity, operation?: PlaneSyncOperation): string {
  const suffix = operation === undefined ? "" : `:${operation}`;
  return buildWorkflowId("plane-sync", `${identityKey(identity)}${suffix}`);
}

interface ChildRequest {
  readonly identity: PlaneSyncIdentity;
  readonly executionMode: "shadow" | "active";
}

function assertChildRequest(input: unknown): asserts input is VersionedPayload<ChildRequest> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new RangeError("plane child request must be a VersionedPayload object");
  }
  const envelope = input as { schemaVersion?: unknown; payload?: unknown };
  if (envelope.schemaVersion !== 1 || typeof envelope.payload !== "object" || envelope.payload === null) {
    throw new RangeError("plane child request must use schemaVersion 1 with an object payload");
  }
  const payload = envelope.payload as { identity?: unknown; executionMode?: unknown };
  if (typeof payload.identity !== "object" || payload.identity === null) {
    throw new RangeError("plane child request must carry an identity object");
  }
  if (payload.executionMode !== "shadow" && payload.executionMode !== "active") {
    throw new RangeError("plane child request executionMode must be shadow or active");
  }
}

/**
 * 非冪等 write 1 件分の共通経路: 三値 authority preflight → shadow 構造抑止 →
 * single-attempt + reconcile。pending は自動再送も成功回収もしない（P3-T07 恒久則）。
 * callback 内 parse は E-CP-CONTRACT に変換し、activity エラーは素通しする。
 */
async function runDedupedWrite(
  operation: PlaneSyncOperation,
  identity: PlaneSyncIdentity,
  executionMode: "shadow" | "active",
  write: (input: VersionedPayload<{ identity: PlaneSyncIdentity }>, key: string) => Promise<unknown>,
): Promise<"executed" | "reconciled" | "shadowed"> {
  const workflowScope = buildPlaneSyncWorkflowId(identity, operation);
  let idempotencyKey: string;
  try {
    idempotencyKey = buildIdempotencyKey(workflowScope, "planeSyncWrite", 0);
  } catch (error) {
    return contractFailure(error);
  }
  const ledgerInput: VersionedPayload<{ identity: PlaneSyncIdentity; operation: PlaneSyncOperation }> = {
    schemaVersion: 1,
    payload: { identity, operation },
  };

  let preflight;
  try {
    preflight = parsePlaneSyncLedgerStatus(
      await reads.findPlaneSyncWrite(ledgerInput, idempotencyKey),
      identity,
      idempotencyKey,
    );
  } catch (error) {
    return contractFailure(error);
  }
  if (preflight.status === "written") return "reconciled";
  if (preflight.status === "pending") {
    return unresolvedFailure(
      `plane sync ledger is pending for ${operation}/${identityKey(identity)}; ` +
        "a pending row cannot prove the write outcome - manual/provider-side reconcile is required " +
        "and automatic redispatch is forbidden",
    );
  }
  if (executionMode === "shadow") return "shadowed";

  try {
    const outcome = await runExternalSideEffect(
      {
        execute: async (_input, key) => write({ schemaVersion: 1, payload: { identity } }, key),
        reconcile: async (key) => {
          const raw = await reads.findPlaneSyncWrite(ledgerInput, key);
          let status;
          try {
            status = parsePlaneSyncLedgerStatus(raw, identity, key);
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
      parsePlaneSyncWriteReceipt(
        outcome.outcome === "reconciled" ? { schemaVersion: 1, payload: outcome.result } : outcome.result,
        identity,
        idempotencyKey,
      );
    } catch (error) {
      return contractFailure(error);
    }
    return outcome.outcome;
  } catch (error) {
    if (error instanceof ExternalSideEffectUnresolvedError) {
      return unresolvedFailure(error.message);
    }
    throw error;
  }
}

/** GitHub → Plane projection child。 */
export async function planeProjectionWorkflow(input: unknown): Promise<VersionedPayload<PlaneChildOutcome>> {
  try {
    assertChildRequest(input);
  } catch (error) {
    return contractFailure(error);
  }
  const { identity, executionMode } = input.payload;
  const outcome = await runDedupedWrite("projection", identity, executionMode, (writeInput, key) =>
    externalWrites.projectToPlane(writeInput, key),
  );
  return { schemaVersion: 1, payload: { operation: "projection", outcome } };
}

/** Plane → platform event child。 */
export async function planeEventWorkflow(input: unknown): Promise<VersionedPayload<PlaneChildOutcome>> {
  try {
    assertChildRequest(input);
  } catch (error) {
    return contractFailure(error);
  }
  const { identity, executionMode } = input.payload;
  const outcome = await runDedupedWrite("event", identity, executionMode, (writeInput, key) =>
    externalWrites.emitPlaneEvent(writeInput, key),
  );
  return { schemaVersion: 1, payload: { operation: "event", outcome } };
}

/** Plane → GitHub promotion child（baseline 固定 + stale check + draft のみ）。 */
export async function planePromotionWorkflow(input: unknown): Promise<VersionedPayload<PlaneChildOutcome>> {
  try {
    assertChildRequest(input);
  } catch (error) {
    return contractFailure(error);
  }
  const { identity, executionMode } = input.payload;
  const identityInput: VersionedPayload<{ identity: PlaneSyncIdentity }> = {
    schemaVersion: 1,
    payload: { identity },
  };

  // authoritative eligibility read（baseline はここで固定される）。
  let eligibility;
  try {
    eligibility = parsePlanePromotionEligibility(await reads.readPromotionEligibility(identityInput), identity);
  } catch (error) {
    return contractFailure(error);
  }
  if (!eligibility.engineeringReady || !eligibility.approved) {
    return { schemaVersion: 1, payload: { operation: "promotion", outcome: "not-eligible" } };
  }

  const workflowScope = buildPlaneSyncWorkflowId(identity, "promotion");
  let idempotencyKey: string;
  try {
    idempotencyKey = buildIdempotencyKey(workflowScope, "createPromotionDraft", 0);
  } catch (error) {
    return contractFailure(error);
  }
  const ledgerInput: VersionedPayload<{ identity: PlaneSyncIdentity; operation: PlaneSyncOperation }> = {
    schemaVersion: 1,
    payload: { identity, operation: "promotion" },
  };

  let preflight;
  try {
    preflight = parsePlaneSyncLedgerStatus(
      await reads.findPlaneSyncWrite(ledgerInput, idempotencyKey),
      identity,
      idempotencyKey,
    );
  } catch (error) {
    return contractFailure(error);
  }
  if (preflight.status === "written") {
    return { schemaVersion: 1, payload: { operation: "promotion", outcome: "reconciled" } };
  }
  if (preflight.status === "pending") {
    return unresolvedFailure(
      `plane promotion ledger is pending for ${identityKey(identity)}; manual reconcile is required`,
    );
  }
  if (executionMode === "shadow") {
    return { schemaVersion: 1, payload: { operation: "promotion", outcome: "shadowed" } };
  }

  // stale check: draft 作成直前に現行 revision を再読し、固定 baseline と不一致なら
  // write なしで stale 終端（正典「baseline revision を固定」の機械的保証）。
  let currentRevision;
  try {
    currentRevision = parsePlaneRevisionReceipt(await reads.readWorkItemRevision(identityInput), identity);
  } catch (error) {
    return contractFailure(error);
  }
  if (currentRevision !== eligibility.baselineRevision) {
    return { schemaVersion: 1, payload: { operation: "promotion", outcome: "stale" } };
  }

  try {
    const outcome = await runExternalSideEffect(
      {
        execute: async (_input, key) =>
          externalWrites.createPromotionDraft(
            { schemaVersion: 1, payload: { identity, baselineRevision: eligibility.baselineRevision } },
            key,
          ),
        reconcile: async (key) => {
          const raw = await reads.findPlaneSyncWrite(ledgerInput, key);
          let status;
          try {
            status = parsePlaneSyncLedgerStatus(raw, identity, key);
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
      try {
        parsePlanePromotionDraftReceipt(outcome.result, identity, idempotencyKey, eligibility.baselineRevision);
      } catch (error) {
        return contractFailure(error);
      }
    }
    return { schemaVersion: 1, payload: { operation: "promotion", outcome: outcome.outcome } };
  } catch (error) {
    if (error instanceof ExternalSideEffectUnresolvedError) {
      return unresolvedFailure(error.message);
    }
    throw error;
  }
}

/** 親: 要求された operation 群を正典の分離どおり child workflow として実行する。 */
export async function planeSyncWorkflow(input: unknown): Promise<VersionedPayload<PlaneSyncResult>> {
  try {
    assertPlaneSyncRequest(input);
  } catch (error) {
    return contractFailure(error);
  }
  const request: PlaneSyncRequest = input.payload;
  const identity: PlaneSyncIdentity = {
    externalSource: request.externalSource,
    externalId: request.externalId,
    projectId: request.projectId,
    mappingVersion: request.mappingVersion,
  };
  const workflowId = buildPlaneSyncWorkflowId(identity);
  const childArgs: [VersionedPayload<ChildRequest>] = [
    { schemaVersion: 1, payload: { identity, executionMode: request.executionMode } },
  ];

  const outcomes: PlaneChildOutcome[] = [];
  for (const operation of request.operations) {
    const child =
      operation === "projection"
        ? planeProjectionWorkflow
        : operation === "event"
          ? planeEventWorkflow
          : planePromotionWorkflow;
    const result = await executeChild(child, {
      workflowId: `${workflowId}/${operation}`,
      args: childArgs,
    });
    outcomes.push(result.payload);
  }

  return {
    schemaVersion: 1,
    payload: {
      workflowId,
      identity,
      phase: request.executionMode === "shadow" ? "shadowed" : "complete",
      outcomes,
    },
  };
}
