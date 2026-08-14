// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / PrjOps:SPEC-INT-050 / PrjOps:SPEC-INT-052 / TMP-003 / ADR-0020
// report delivery workflow（WBS P3-T07: generation → validation → [approval] → delivery）。
// 承認は正典 PrjOps:SPEC-INT-050 どおり PRF-04/05 のみ（P3-T07-001: PRF-01..03 の
// 承認不要経路を保存し、承認の捏造も bypass も parser/実行時検証で遮断）。
// 配信 authority read は absent|pending|sent の三値（P3-T07-002: 実 DeliveryLogStore
// は send 前に pending を記録するため、pending は「送信済みか不明」— 自動再送も
// 成功回収もせず unresolved 終了し、手動/provider 側同定の reconcile のみが解消する）。

import { ApplicationFailure, executeChild, proxyActivities } from "@temporalio/workflow";

import type { VersionedPayload } from "../contracts/index.js";
import { buildIdempotencyKey } from "../lib/idempotency.js";
import {
  assertReportDeliveryRequest,
  parseReportDeliveryLedgerStatus,
  parseReportDeliveryReceipt,
  parseReportGenerationReceipt,
  parseReportProfileReceipt,
  parseReportValidationReceipt,
  type ReportDeliveryRequest,
  type ReportProfile,
} from "../lib/reportDeliveryState.js";
import { toTemporalRetryPolicy } from "../lib/retryPolicies.js";
import { buildWorkflowId } from "../lib/workflowId.js";
import { approvalWorkflow, type ApprovalOutcome } from "./approval.js";
import { ExternalSideEffectUnresolvedError, runExternalSideEffect } from "./sideEffect.js";

export interface ReportDeliveryActivities {
  /**
   * report profile の解決（read-only）。実装契約: prjops reportJobStateMachine の
   * requiresApproval を正本として返す。receipt は正典対応（PRF-04/05 のみ承認必須）
   * と矛盾すると E-CP-CONTRACT で拒否される。
   */
  resolveReportProfile(input: VersionedPayload<{ reportId: string }>): Promise<unknown>;
  /** report 生成（冪等 write）。receipt は reportId + contentChecksum を返す。 */
  generateReport(input: VersionedPayload<{ reportId: string }>): Promise<unknown>;
  /** 生成物の検証（read-only）。数値・表はコード算出済みであることの検分を含む。 */
  validateReport(input: VersionedPayload<{ reportId: string; contentChecksum: string }>): Promise<unknown>;
  /**
   * DeliveryLogStore（正本）を読む per-recipient authority read。
   * 返却契約: 記録なし = null / pending 行 = {status:"pending"} /
   * sent 行 = {status:"sent", idempotencyKey 含む receipt 形}。
   */
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
  readonly profile: ReportProfile | null;
  readonly contentChecksum: string | null;
  readonly validationReason: string | null;
  readonly approvalStatus: "approved" | "rejected" | "expired" | "not-required" | null;
  readonly deliveries: ReadonlyArray<{
    readonly recipientId: string;
    readonly outcome: "executed" | "reconciled" | "shadowed";
  }>;
}

const idempotentWrites = proxyActivities<Pick<ReportDeliveryActivities, "generateReport">>({
  startToCloseTimeout: "5 minutes",
  retry: toTemporalRetryPolicy("idempotent-write"),
});

const reads = proxyActivities<
  Pick<ReportDeliveryActivities, "resolveReportProfile" | "validateReport" | "findReportDelivery">
>({
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

function unresolvedFailure(message: string): never {
  throw ApplicationFailure.nonRetryable(message, "E-CP-EXTERNAL-UNRESOLVED");
}

/**
 * generation → validation → [approval（PRF-04/05 のみ）] → per-recipient delivery。
 * timeout・拒否・validation 失敗・pending 台帳のいずれからも complete へ自動遷移する
 * 経路はない。
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
      profile: null,
      contentChecksum: null,
      validationReason: null,
      approvalStatus: null,
      deliveries: [],
      ...partial,
    },
  });

  // profile 解決（正典対応の強制は parser 側）。要否と approval パラメータの
  // 存在は相互に一致しなければならない（不足 = bypass 不能、過剰 = 捏造拒否）。
  let profileReceipt;
  try {
    profileReceipt = parseReportProfileReceipt(
      await reads.resolveReportProfile({ schemaVersion: 1, payload: { reportId: request.reportId } }),
      request.reportId,
    );
  } catch (error) {
    return contractFailure(error);
  }
  if (profileReceipt.requiresApproval && request.approval === null) {
    return contractFailure(
      new RangeError(
        `profile ${profileReceipt.profile} requires approval parameters (PRF-04/05 cannot bypass approval)`,
      ),
    );
  }
  if (!profileReceipt.requiresApproval && request.approval !== null) {
    return contractFailure(
      new RangeError(
        `profile ${profileReceipt.profile} is approval-free; approval parameters must not be manufactured`,
      ),
    );
  }

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

  // validation（read-only）。invalid は failed 終端（承認・配信へ進まない）。
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
      profile: profileReceipt.profile,
      contentChecksum: generation.contentChecksum,
      validationReason: validation.reason,
    });
  }

  // approval（PRF-04/05 のみ。P3-T03 child。rejected/expired は failed 終端）
  let approvalStatus: ReportDeliveryResult["approvalStatus"] = "not-required";
  if (profileReceipt.requiresApproval && request.approval !== null) {
    const approval: VersionedPayload<ApprovalOutcome> = await executeChild(approvalWorkflow, {
      workflowId: `${workflowId}/approval`,
      args: [
        {
          schemaVersion: 1,
          payload: {
            approvalId: request.approval.approvalId,
            version: request.approval.approvalVersion,
            expiryMs: request.approval.approvalExpiryMs,
            requestedBy: request.requestedBy,
          },
        },
      ],
    });
    if (approval.payload.status !== "approved") {
      return finish({
        phase: "failed",
        failureReason: approval.payload.status === "expired" ? "approval-expired" : "approval-rejected",
        profile: profileReceipt.profile,
        contentChecksum: generation.contentChecksum,
        approvalStatus: approval.payload.status,
      });
    }
    approvalStatus = "approved";
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

    // authority preflight（三値）。sent のみ回収、pending は自動再送せず unresolved。
    let preflight;
    try {
      preflight = parseReportDeliveryLedgerStatus(
        await reads.findReportDelivery(deliveryInput, idempotencyKey),
        request.reportId,
        recipientId,
        idempotencyKey,
      );
    } catch (error) {
      return contractFailure(error);
    }
    if (preflight.status === "sent") {
      deliveries.push({ recipientId, outcome: "reconciled" });
      continue;
    }
    if (preflight.status === "pending") {
      return unresolvedFailure(
        `delivery ledger is pending for ${request.reportId}::${recipientId}; ` +
          "a pending row cannot prove the send outcome - manual/provider-side reconcile is required " +
          "and automatic redispatch is forbidden (PrjOps:SPEC-EXT-023)",
      );
    }
    if (request.executionMode === "shadow") {
      deliveries.push({ recipientId, outcome: "shadowed" });
      continue;
    }

    try {
      const outcome = await runExternalSideEffect(
        {
          execute: async (_input, key) => externalWrites.deliverReport(deliveryInput, key),
          // 応答喪失後の reconcile も三値: sent のみ回収し、pending/absent は
          // null（= 未解決）として扱う。pending の自動再送経路は存在しない。
          reconcile: async (key) => {
            const status = parseReportDeliveryLedgerStatus(
              await reads.findReportDelivery(deliveryInput, key),
              request.reportId,
              recipientId,
              key,
            );
            return status.status === "sent" ? status.receipt : null;
          },
        },
        deliveryInput.payload,
        idempotencyKey,
      );
      try {
        parseReportDeliveryReceipt(
          outcome.outcome === "reconciled" ? { schemaVersion: 1, payload: outcome.result } : outcome.result,
          request.reportId,
          recipientId,
          idempotencyKey,
        );
      } catch (error) {
        return contractFailure(error);
      }
      deliveries.push({ recipientId, outcome: outcome.outcome });
    } catch (error) {
      if (error instanceof ExternalSideEffectUnresolvedError) {
        // 成功偽装しない。台帳の pending 行が残り、次回実行は preflight で
        // unresolved になる（自動再送しない）。解消は手動/provider 側同定のみ。
        return unresolvedFailure(error.message);
      }
      throw error;
    }
  }

  return finish({
    phase: request.executionMode === "shadow" ? "shadowed" : "complete",
    failureReason: null,
    profile: profileReceipt.profile,
    contentChecksum: generation.contentChecksum,
    approvalStatus,
    deliveries,
  });
}
