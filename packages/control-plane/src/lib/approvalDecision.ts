// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / ADR-0020 / DevOps:SPEC-EXT-010
// approval child workflow の decision 判定（TMP-002: versioned + stale rejected）。
// 純粋関数のみ。承認権威の正本は approvalsRepo（DB CAS）であり、ここは
// workflow 待機中に受けた signal の受理可否を決定的に判定するだけ。

/** workflow が待ち受ける approval 要求の束縛情報。 */
export interface ApprovalWaitState {
  readonly approvalId: string;
  /** 要求時点の approval version。signal はこの値への CAS でのみ受理される。 */
  readonly version: number;
  readonly decided: boolean;
}

export type ApprovalDecision = "approved" | "rejected";

/** decision signal の payload。 */
export interface ApprovalDecisionSignalPayload {
  readonly approvalId: string;
  readonly version: number;
  readonly decision: ApprovalDecision;
  readonly approverObjectId: string;
  readonly reason?: string;
}

export type SignalRejectReason =
  | "malformed-payload"
  | "already-decided"
  | "approval-id-mismatch"
  | "stale-version"
  | "invalid-decision"
  | "missing-approver";

export type SignalEvaluation =
  | { readonly accepted: true; readonly decision: ApprovalDecision }
  | { readonly accepted: false; readonly reason: SignalRejectReason };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

/** approval workflow 入力の境界検証。契約違反は E-CP-CONTRACT 相当（non-retryable）。 */
export function assertApprovalRequest(input: { approvalId: string; version: number; expiryMs: number }): void {
  if (!UUID_PATTERN.test(input.approvalId)) {
    throw new RangeError(`approvalId must be a lowercase UUID (got ${JSON.stringify(input.approvalId)})`);
  }
  if (!Number.isSafeInteger(input.version) || input.version < 1) {
    throw new RangeError(`version must be a positive safe integer (got ${String(input.version)})`);
  }
  if (!Number.isSafeInteger(input.expiryMs) || input.expiryMs < 1) {
    throw new RangeError(`expiryMs must be a positive safe integer (got ${String(input.expiryMs)})`);
  }
}

/**
 * decision signal の受理可否。受理は「未決 かつ approvalId 一致 かつ version 完全一致
 * （CAS） かつ decision が approved|rejected かつ approver 記名あり」のときのみ。
 * それ以外はすべて拒否理由付きで stale 扱い（自動承認への転落経路を作らない）。
 *
 * defineSignal の型は transport 境界を保証しないため、入力は unknown として
 * 参照前に形を検証する（P3-T03-001: null 等の不正 payload が handler を throw
 * させると workflow task が無限 retry になり expiry まで到達できない）。
 */
export function evaluateDecisionSignal(state: ApprovalWaitState, signal: unknown): SignalEvaluation {
  if (typeof signal !== "object" || signal === null || Array.isArray(signal)) {
    return { accepted: false, reason: "malformed-payload" };
  }
  const candidate = signal as Partial<ApprovalDecisionSignalPayload>;
  if (typeof candidate.approvalId !== "string" || typeof candidate.version !== "number") {
    return { accepted: false, reason: "malformed-payload" };
  }
  if (state.decided) return { accepted: false, reason: "already-decided" };
  if (candidate.approvalId !== state.approvalId) return { accepted: false, reason: "approval-id-mismatch" };
  if (candidate.version !== state.version) return { accepted: false, reason: "stale-version" };
  if (candidate.decision !== "approved" && candidate.decision !== "rejected") {
    return { accepted: false, reason: "invalid-decision" };
  }
  if (typeof candidate.approverObjectId !== "string" || candidate.approverObjectId.trim().length === 0) {
    return { accepted: false, reason: "missing-approver" };
  }
  return { accepted: true, decision: candidate.decision };
}
