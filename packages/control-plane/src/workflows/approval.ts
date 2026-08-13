// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / ADR-0020 / DevOps:SPEC-EXT-010
// approval child workflow（正典 component spec 01「approvalはSignal/Update +
// version/CAS」、TMP-002）。明示 signal のみが approved/rejected を確定し、
// 期限超過は expired（自動承認なし）。承認権威の正本は approvalsRepo（DB CAS）。

import { condition, defineQuery, defineSignal, setHandler } from "@temporalio/workflow";

import {
  assertApprovalRequest,
  evaluateDecisionSignal,
  type ApprovalDecisionSignalPayload,
  type SignalRejectReason,
} from "../lib/approvalDecision.js";
import type { VersionedPayload } from "../contracts/index.js";

export interface ApprovalRequest {
  readonly approvalId: string;
  /** 要求時点の approval version（CAS 対象）。 */
  readonly version: number;
  readonly expiryMs: number;
  readonly requestedBy: string;
}

export interface ApprovalOutcome {
  readonly approvalId: string;
  readonly version: number;
  readonly status: "approved" | "rejected" | "expired";
  readonly approverObjectId: string | null;
  readonly reason: string | null;
  /** 拒否した stale/不正 signal の内訳（監査・テスト用の決定的カウンタ）。 */
  readonly rejectedSignals: Readonly<Record<SignalRejectReason, number>>;
}

export const approvalDecisionSignal = defineSignal<[ApprovalDecisionSignalPayload]>("approvalDecision");
export const approvalStateQuery = defineQuery<{ decided: boolean; version: number }>("approvalState");

/**
 * durable な承認待ち。受理条件は evaluateDecisionSignal（version 完全一致 CAS）に
 * 集約し、期限超過は expired として完了する。timeout・既定値・signal 不達の
 * いずれからも approved には到達しない（no auto-approval）。
 */
export async function approvalWorkflow(
  input: VersionedPayload<ApprovalRequest>,
): Promise<VersionedPayload<ApprovalOutcome>> {
  const request = input.payload;
  assertApprovalRequest(request);

  const rejectedSignals: Record<SignalRejectReason, number> = {
    "already-decided": 0,
    "approval-id-mismatch": 0,
    "stale-version": 0,
    "invalid-decision": 0,
    "missing-approver": 0,
  };
  let accepted: ApprovalDecisionSignalPayload | undefined;

  setHandler(approvalDecisionSignal, (signal) => {
    const evaluation = evaluateDecisionSignal(
      { approvalId: request.approvalId, version: request.version, decided: accepted !== undefined },
      signal,
    );
    if (evaluation.accepted) {
      accepted = signal;
    } else {
      rejectedSignals[evaluation.reason] += 1;
    }
  });
  setHandler(approvalStateQuery, () => ({ decided: accepted !== undefined, version: request.version }));

  const decidedInTime = await condition(() => accepted !== undefined, request.expiryMs);
  const outcome: ApprovalOutcome =
    decidedInTime && accepted !== undefined
      ? {
          approvalId: request.approvalId,
          version: request.version,
          status: accepted.decision,
          approverObjectId: accepted.approverObjectId,
          reason: accepted.reason ?? null,
          rejectedSignals,
        }
      : {
          approvalId: request.approvalId,
          version: request.version,
          status: "expired",
          approverObjectId: null,
          reason: null,
          rejectedSignals,
        };
  return { schemaVersion: 1, payload: outcome };
}
