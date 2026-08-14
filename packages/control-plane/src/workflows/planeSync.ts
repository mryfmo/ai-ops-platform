// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / FinalArch:CON-002 / TMP-003 / ADR-0020 / ADR-0023
// PlaneSyncWorkflow（正典 component spec 01/08）。projection / event / promotion を
// 別 child workflow に分離し、親は順序と結果集約のみを担う。
// - dedupe 恒等 = (external_source, external_id, project_id, mapping_version)
// - unknown write result は reconcile（三値 ledger。pending は自動再送も成功回収もしない）
// - promotion は authoritative eligibility read で baseline revision を固定し、
//   stale 保証は write authority の CAS（created|stale union receipt）が担う。
//   receipt は baseline echo + draft:true を束縛（operationBoundary の draft 境界）。

import { ApplicationFailure, executeChild, proxyActivities } from "@temporalio/workflow";

import type { VersionedPayload } from "../contracts/index.js";
import { buildIdempotencyKey } from "../lib/idempotency.js";
import {
  assertPlaneSyncIdentity,
  assertPlaneSyncRequest,
  parsePlanePromotionEligibility,
  parsePlanePromotionLedgerStatus,
  parsePlanePromotionWriteResult,
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
   * Plane → GitHub promotion（非冪等 write）。実装契約:
   * - stale 保証は write authority の CAS/precondition が担う: 現行 revision が
   *   入力 baseline と一致するときのみ作成し、移動していれば result:"stale" を返す
   *   （P3-T08-004 — 事前 read の比較では read と write の間の移動を防げない）
   * - 作成は draft PR/Issue まで（result:"created" は baseline echo + draft:true）。
   *   merge・formal publish はこの activity から到達不能であること。runtime 結線時は
   *   integrations の operationBoundary（plane: read+draft）配下の adapter を用いる
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
  // P3-T08-002: child は直接起動可能な trust boundary。親と同一の完全検証を通す。
  assertPlaneSyncIdentity(payload.identity);
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
  let idempotencyKey: string;
  try {
    // P3-T08-001: ID 構築も contract 圏内（文法拘束後も防御的に変換する）。
    const workflowScope = buildPlaneSyncWorkflowId(identity, operation);
    idempotencyKey = buildIdempotencyKey(workflowScope, "planeSyncWrite", 0);
  } catch (error) {
    return contractFailure(error);
  }
  const ledgerInput: VersionedPayload<{ identity: PlaneSyncIdentity; operation: PlaneSyncOperation }> = {
    schemaVersion: 1,
    payload: { identity, operation },
  };

  // P3-T08-005: activity の await と parse を分離（activity/runtime エラーは素通し）。
  const preflightRaw = await reads.findPlaneSyncWrite(ledgerInput, idempotencyKey);
  let preflight;
  try {
    preflight = parsePlaneSyncLedgerStatus(preflightRaw, identity, idempotencyKey);
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
  const eligibilityRaw = await reads.readPromotionEligibility(identityInput);
  let eligibility;
  try {
    eligibility = parsePlanePromotionEligibility(eligibilityRaw, identity);
  } catch (error) {
    return contractFailure(error);
  }
  if (!eligibility.engineeringReady || !eligibility.approved) {
    return { schemaVersion: 1, payload: { operation: "promotion", outcome: "not-eligible" } };
  }

  let idempotencyKey: string;
  try {
    const workflowScope = buildPlaneSyncWorkflowId(identity, "promotion");
    idempotencyKey = buildIdempotencyKey(workflowScope, "createPromotionDraft", 0);
  } catch (error) {
    return contractFailure(error);
  }
  const ledgerInput: VersionedPayload<{ identity: PlaneSyncIdentity; operation: PlaneSyncOperation }> = {
    schemaVersion: 1,
    payload: { identity, operation: "promotion" },
  };

  // P3-T08-003: promotion の ledger は draft receipt 形（baseline provenance +
  // draft:true）のみ受理。過去 run の正当な draft は baseline 任意（null）。
  const promotionPreflightRaw = await reads.findPlaneSyncWrite(ledgerInput, idempotencyKey);
  let preflight;
  try {
    preflight = parsePlanePromotionLedgerStatus(promotionPreflightRaw, identity, idempotencyKey, null);
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
  const revisionRaw = await reads.readWorkItemRevision(identityInput);
  let currentRevision;
  try {
    currentRevision = parsePlaneRevisionReceipt(revisionRaw, identity);
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
        // 同一 run 内の lost-response reconcile は pinned baseline の完全一致を要求
        // （P3-T08-003）。parse 失敗のみ E-CP-CONTRACT（activity エラーは素通し）。
        reconcile: async (key) => {
          const raw = await reads.findPlaneSyncWrite(ledgerInput, key);
          let status;
          try {
            status = parsePlanePromotionLedgerStatus(raw, identity, key, eligibility.baselineRevision);
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
      // CAS union（P3-T08-004）: created は baseline echo + draft:true、
      // stale は write なしの正当な終端。
      let writeResult;
      try {
        writeResult = parsePlanePromotionWriteResult(
          outcome.result,
          identity,
          idempotencyKey,
          eligibility.baselineRevision,
        );
      } catch (error) {
        return contractFailure(error);
      }
      if (writeResult.kind === "stale") {
        return { schemaVersion: 1, payload: { operation: "promotion", outcome: "stale" } };
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
  let workflowId: string;
  try {
    workflowId = buildPlaneSyncWorkflowId(identity);
  } catch (error) {
    return contractFailure(error);
  }
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
