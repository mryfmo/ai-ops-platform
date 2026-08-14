// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / PrjOps:SPEC-INT-052 / TMP-003 / ADR-0020
// report delivery workflow（正典 component spec 01 の Report 系列、WBS P3-T07:
// generation → validation → approval → delivery）。承認は P3-T03 approvalWorkflow
// の child、配信は per-recipient の authority read → shadow 構造抑止 →
// single-attempt + reconcile（recipient idempotency = DeliveryLogStore 正本）。
// 権限 profile の適用は deliverReport activity 実装側の契約（配信時・リクエスト毎）。

import { ApplicationFailure, executeChild, proxyActivities } from "@temporalio/workflow";

import type { VersionedPayload } from "../contracts/index.js";
import { buildIdempotencyKey } from "../lib/idempotency.js";
import {
  assertReportDeliveryRequest,
  parseOptionalReportDeliveryReceipt,
  parseReportDeliveryReceipt,
  parseReportGenerationReceipt,
  parseReportValidationReceipt,
  type ReportDeliveryRequest,
} from "../lib/reportDeliveryState.js";
import { toTemporalRetryPolicy } from "../lib/retryPolicies.js";
import { buildWorkflowId } from "../lib/workflowId.js";
import { approvalWorkflow, type ApprovalOutcome } from "./approval.js";
import { ExternalSideEffectUnresolvedError, runExternalSideEffect } from "./sideEffect.js";

export interface ReportDeliveryActivities {
  /** report 生成（冪等 write）。receipt は reportId + contentChecksum を返す。 */
  generateReport(input: VersionedPayload<{ reportId: string }>): Promise<unknown>;
  /** 生成物の検証（read-only）。数値・表はコード算出済みであることの検分を含む。 */
  validateReport(input: VersionedPayload<{ reportId: string; contentChecksum: string }>): Promise<unknown>;
  /** DeliveryLogStore（正本）を読む per-recipient authority read。未配信なら null。 */
  findReportDelivery(
    input: VersionedPayload<{ reportId: string; recipientId: string }>,
    idempotencyKey: string,
  ): Promise<unknown>;
  /**
   * 非冪等配信。実装契約: 配信時に reportPermissionFilter / isActiveRecipient を
   * リクエスト毎に適用する（キャッシュ禁止 — 設計原則 6）。scope 外・非 active は
   * 実装側で配信せず receipt を返さない（activity 失敗）こと。workflow は
   * reportId/recipientId のみ搬送し report 内容・profile 判定を持たない。
   */
  deliverReport(
    input: VersionedPayload<{ reportId: string; recipientId: string }>,
    idempotencyKey: string,
  ): Promise<unknown>;
}

export interface ReportDeliveryResult {
  readonly reportId: string;
  readonly workflowId: string;
  readonly phase: "complete" | "failed" | "shadowed";
  readonly failureReason: "validation-failed" | "approval-rejected" | "approval-expired" | null;
  readonly contentChecksum: string | null;
  readonly validationReason: string | null;
  readonly approvalStatus: "approved" | "rejected" | "expired" | null;
  readonly deliveries: ReadonlyArray<{
    readonly recipientId: string;
    readonly outcome: "executed" | "reconciled" | "shadowed";
  }>;
}

const idempotentWrites = proxyActivities<Pick<ReportDeliveryActivities, "generateReport">>({
  startToCloseTimeout: "5 minutes",
  retry: toTemporalRetryPolicy("idempotent-write"),
});

const reads = proxyActivities<Pick<ReportDeliveryActivities, "validateReport" | "findReportDelivery">>({
  startToCloseTimeout: "60 seconds",
  retry: toTemporalRetryPolicy("read"),
});

const externalWrites = proxyActivities<Pick<ReportDeliveryActivities, "deliverReport">>({
  startToCloseTimeout: "60 seconds",
  retry: toTemporalRetryPolicy("external-side-effect"),
});

export function buildReportDeliveryWorkflowId(reportId: string): string {
  return buildWorkflowId("report", `delivery:${reportId}`);
}

function contractFailure(error: unknown): never {
  throw ApplicationFailure.nonRetryable(
    error instanceof Error ? error.message : "invalid report delivery workflow contract",
    "E-CP-CONTRACT",
  );
}

/**
 * generation → validation → approval → per-recipient delivery の耐久実行。
 * timeout・拒否・validation 失敗のいずれからも complete へ自動遷移する経路はない。
 */
export async function reportDeliveryWorkflow(input: unknown): Promise<VersionedPayload<ReportDeliveryResult>> {
  try {
    assertReportDeliveryRequest(input);
  } catch (error) {
    return contractFailure(error);
  }
  const request: ReportDeliveryRequest = input.payload;
  let workflowId: string;
  try {
    workflowId = buildReportDeliveryWorkflowId(request.reportId);
  } catch (error) {
    return contractFailure(error);
  }

  const finish = (
    partial: Pick<ReportDeliveryResult, "phase" | "failureReason"> &
      Partial<Omit<ReportDeliveryResult, "reportId" | "workflowId" | "phase" | "failureReason">>,
  ): VersionedPayload<ReportDeliveryResult> => ({
    schemaVersion: 1,
    payload: {
      reportId: request.reportId,
      workflowId,
      contentChecksum: null,
      validationReason: null,
      approvalStatus: null,
      deliveries: [],
      ...partial,
    },
  });

  // generation（冪等 write。receipt は reportId 束縛）
  let generation;
  try {
    generation = parseReportGenerationReceipt(
      await idempotentWrites.generateReport({ schemaVersion: 1, payload: { reportId: request.reportId } }),
      request.reportId,
    );
  } catch (error) {
    return contractFailure(error);
  }

  // validation（read-only）。invalid は failed 終端（配信・承認へ進まない）。
  let validation;
  try {
    validation = parseReportValidationReceipt(
      await reads.validateReport({
        schemaVersion: 1,
        payload: { reportId: request.reportId, contentChecksum: generation.contentChecksum },
      }),
      request.reportId,
    );
  } catch (error) {
    return contractFailure(error);
  }
  if (!validation.valid) {
    return finish({
      phase: "failed",
      failureReason: "validation-failed",
      contentChecksum: generation.contentChecksum,
      validationReason: validation.reason,
    });
  }

  // approval（P3-T03 child。rejected/expired は failed 終端 = no auto-approval）
  const approval: VersionedPayload<ApprovalOutcome> = await executeChild(approvalWorkflow, {
    workflowId: `${workflowId}/approval`,
    args: [
      {
        schemaVersion: 1,
        payload: {
          approvalId: request.approvalId,
          version: request.approvalVersion,
          expiryMs: request.approvalExpiryMs,
          requestedBy: request.requestedBy,
        },
      },
    ],
  });
  if (approval.payload.status !== "approved") {
    return finish({
      phase: "failed",
      failureReason: approval.payload.status === "expired" ? "approval-expired" : "approval-rejected",
      contentChecksum: generation.contentChecksum,
      approvalStatus: approval.payload.status,
    });
  }

  // per-recipient delivery。key は (reportId, recipientId) から決定的
  // （PrjOps:SPEC-INT-052 の reportId::recipientId 冪等単位に一致）。
  const deliveries: Array<{ recipientId: string; outcome: "executed" | "reconciled" | "shadowed" }> = [];
  for (const recipient of request.recipients) {
    const recipientId = recipient.recipientId;
    const deliveryInput: VersionedPayload<{ reportId: string; recipientId: string }> = {
      schemaVersion: 1,
      payload: { reportId: request.reportId, recipientId },
    };
    let idempotencyKey: string;
    try {
      idempotencyKey = buildIdempotencyKey(`${workflowId}:${recipientId}`, "deliverReport", 0);
    } catch (error) {
      return contractFailure(error);
    }
    const reconcile = async (key: string): Promise<unknown> => reads.findReportDelivery(deliveryInput, key);

    let existing;
    try {
      existing = parseOptionalReportDeliveryReceipt(
        await reconcile(idempotencyKey),
        request.reportId,
        recipientId,
        idempotencyKey,
      );
    } catch (error) {
      return contractFailure(error);
    }
    if (existing !== null) {
      deliveries.push({ recipientId, outcome: "reconciled" });
      continue;
    }
    if (request.executionMode === "shadow") {
      deliveries.push({ recipientId, outcome: "shadowed" });
      continue;
    }

    try {
      const outcome = await runExternalSideEffect(
        {
          execute: async (_input, key) => externalWrites.deliverReport(deliveryInput, key),
          reconcile,
        },
        deliveryInput.payload,
        idempotencyKey,
      );
      try {
        parseReportDeliveryReceipt(outcome.result, request.reportId, recipientId, idempotencyKey);
      } catch (error) {
        return contractFailure(error);
      }
      deliveries.push({ recipientId, outcome: outcome.outcome });
    } catch (error) {
      if (error instanceof ExternalSideEffectUnresolvedError) {
        // 成功偽装しない。既配信分は DeliveryLogStore が保持し、再実行は
        // authority read → reconciled で二重配信しない（PrjOps:SPEC-EXT-023）。
        throw ApplicationFailure.nonRetryable(error.message, "E-CP-EXTERNAL-UNRESOLVED");
      }
      throw error;
    }
  }

  return finish({
    phase: request.executionMode === "shadow" ? "shadowed" : "complete",
    failureReason: null,
    contentChecksum: generation.contentChecksum,
    approvalStatus: "approved",
    deliveries,
  });
}
