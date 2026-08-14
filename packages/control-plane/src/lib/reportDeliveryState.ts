// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / PrjOps:SPEC-INT-052 / TMP-003 / ADR-0020
// report delivery workflow の入力・activity receipt を決定的に検証する純粋関数。
// 権威の正本は複製しない: 配信冪等は DeliveryLogStore（reportId::recipientId）、
// 承認は approvalsRepo（P3-T03 child）、権限は reportPermissionFilter（配信時・
// リクエスト毎）。ここは unknown 受けの形検証と束縛のみを担う。

export type ReportDeliveryExecutionMode = "shadow" | "active";

/** 正典 PrjOps:SPEC-INT-050 の report profile。 */
export const REPORT_PROFILES = ["PRF-01", "PRF-02", "PRF-03", "PRF-04", "PRF-05"] as const;
export type ReportProfile = (typeof REPORT_PROFILES)[number];

/** 正典どおり PRF-04/05 のみ承認必須（reportJobStateMachine.requiresApproval と同一対応）。 */
export function profileRequiresApproval(profile: ReportProfile): boolean {
  return profile === "PRF-04" || profile === "PRF-05";
}

export interface ReportRecipient {
  readonly recipientId: string;
}

export interface ReportApprovalParameters {
  readonly approvalId: string;
  readonly approvalVersion: number;
  readonly approvalExpiryMs: number;
}

export interface ReportDeliveryRequest {
  readonly reportId: string;
  /** PRF-04/05 のみ必須。PRF-01..03 に承認を捏造しない（P3-T07-001）。 */
  readonly approval: ReportApprovalParameters | null;
  readonly executionMode: ReportDeliveryExecutionMode;
  readonly recipients: readonly ReportRecipient[];
  readonly requestedBy: string;
}

/** 生成 receipt。contentChecksum は生成物の同一性追跡（内容自体は搬送しない）。 */
export interface ReportGenerationReceipt {
  readonly reportId: string;
  readonly contentChecksum: string;
}

export interface ReportValidationReceipt {
  readonly reportId: string;
  readonly valid: boolean;
  readonly reason: string | null;
}

/** 配信 receipt。reportId・recipientId・idempotencyKey に束縛される。 */
export interface ReportDeliveryReceipt {
  readonly reportId: string;
  readonly recipientId: string;
  readonly idempotencyKey: string;
}

/** profile 分類 receipt。activity 実装は prjops requiresApproval を正本として返す。 */
export interface ReportProfileReceipt {
  readonly reportId: string;
  readonly profile: ReportProfile;
  readonly requiresApproval: boolean;
}

/**
 * 配信 authority read の三値。実 DeliveryLogStore は send 前に pending を記録し
 * 応答後に sent を記す（P3-T07-002）。pending は「送信済みか不明」であり、
 * 自動再送も成功回収もしてはならない（手動/provider 側同定の reconcile のみ）。
 */
export type ReportDeliveryLedgerStatus =
  | { readonly status: "sent"; readonly receipt: ReportDeliveryReceipt }
  | { readonly status: "pending" }
  | { readonly status: "absent" };

const REPORT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,150}$/u;
const RECIPIENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._@-]{0,150}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Temporal payload は runtime では unknown のため、封筒全体を参照前に検証する。 */
export function assertReportDeliveryRequest(input: unknown): asserts input is {
  schemaVersion: 1;
  payload: ReportDeliveryRequest;
} {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new RangeError("report delivery request must be a VersionedPayload object");
  }
  const envelope = input as { schemaVersion?: unknown; payload?: unknown };
  if (envelope.schemaVersion !== 1 || typeof envelope.payload !== "object" || envelope.payload === null) {
    throw new RangeError("report delivery request must use schemaVersion 1 with an object payload");
  }
  const payload = envelope.payload as Record<string, unknown>;
  if (typeof payload.reportId !== "string" || !REPORT_ID_PATTERN.test(payload.reportId)) {
    throw new RangeError("reportId must be a canonical nonblank identifier");
  }
  if (payload.approval !== null) {
    if (typeof payload.approval !== "object" || Array.isArray(payload.approval) || payload.approval === undefined) {
      throw new RangeError("approval must be null or an approval-parameter object");
    }
    const approval = payload.approval as Record<string, unknown>;
    if (typeof approval.approvalId !== "string" || !UUID_PATTERN.test(approval.approvalId)) {
      throw new RangeError("approval.approvalId must be a lowercase UUID");
    }
    if (!Number.isSafeInteger(approval.approvalVersion) || (approval.approvalVersion as number) < 1) {
      throw new RangeError("approval.approvalVersion must be a positive safe integer");
    }
    if (!Number.isSafeInteger(approval.approvalExpiryMs) || (approval.approvalExpiryMs as number) < 1) {
      throw new RangeError("approval.approvalExpiryMs must be a positive safe integer");
    }
  }
  if (payload.executionMode !== "shadow" && payload.executionMode !== "active") {
    throw new RangeError("executionMode must be shadow or active");
  }
  if (!Array.isArray(payload.recipients) || payload.recipients.length === 0) {
    throw new RangeError("recipients must be a non-empty array");
  }
  const seen = new Set<string>();
  for (const recipient of payload.recipients as unknown[]) {
    if (typeof recipient !== "object" || recipient === null || Array.isArray(recipient)) {
      throw new RangeError("each recipient must be an object");
    }
    const id = (recipient as { recipientId?: unknown }).recipientId;
    if (typeof id !== "string" || !RECIPIENT_ID_PATTERN.test(id)) {
      throw new RangeError("recipientId must be a canonical nonblank identifier");
    }
    if (seen.has(id)) {
      throw new RangeError(`recipients must be unique (duplicate ${JSON.stringify(id)})`);
    }
    seen.add(id);
  }
  if (!isNonBlankString(payload.requestedBy)) {
    throw new RangeError("requestedBy must be a non-blank string");
  }
}

function parseEnvelope(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RangeError(`${label} must use schemaVersion 1 with an object payload`);
  }
  const envelope = value as { schemaVersion?: unknown; payload?: unknown };
  if (envelope.schemaVersion !== 1 || typeof envelope.payload !== "object" || envelope.payload === null) {
    throw new RangeError(`${label} must use schemaVersion 1 with an object payload`);
  }
  return envelope.payload as Record<string, unknown>;
}

/**
 * profile receipt。正典対応（PRF-04/05 のみ承認必須）と receipt の requiresApproval
 * が一致しない場合は拒否する — bypass（PRF-04/05 を承認不要と偽る）も
 * 捏造（PRF-01..03 に承認を要求する）も両方向で遮断（P3-T07-001）。
 */
export function parseReportProfileReceipt(value: unknown, reportId: string): ReportProfileReceipt {
  const receipt = parseEnvelope(value, "report profile receipt");
  if (
    receipt.reportId !== reportId ||
    typeof receipt.profile !== "string" ||
    !(REPORT_PROFILES as readonly string[]).includes(receipt.profile) ||
    typeof receipt.requiresApproval !== "boolean"
  ) {
    throw new RangeError("report profile receipt does not match the requested report");
  }
  const profile = receipt.profile as ReportProfile;
  if (receipt.requiresApproval !== profileRequiresApproval(profile)) {
    throw new RangeError("report profile receipt contradicts the canonical approval mapping");
  }
  return { reportId, profile, requiresApproval: receipt.requiresApproval };
}

export function parseReportGenerationReceipt(value: unknown, reportId: string): ReportGenerationReceipt {
  const receipt = parseEnvelope(value, "report generation receipt");
  if (receipt.reportId !== reportId || !isNonBlankString(receipt.contentChecksum)) {
    throw new RangeError("report generation receipt does not match the requested report");
  }
  return { reportId, contentChecksum: receipt.contentChecksum };
}

export function parseReportValidationReceipt(value: unknown, reportId: string): ReportValidationReceipt {
  const receipt = parseEnvelope(value, "report validation receipt");
  if (receipt.reportId !== reportId || typeof receipt.valid !== "boolean") {
    throw new RangeError("report validation receipt does not match the requested report");
  }
  if (receipt.valid === false && !isNonBlankString(receipt.reason)) {
    throw new RangeError("invalid report validation receipt must carry a non-blank reason");
  }
  return { reportId, valid: receipt.valid, reason: receipt.valid ? null : (receipt.reason as string) };
}

export function parseReportDeliveryReceipt(
  value: unknown,
  reportId: string,
  recipientId: string,
  idempotencyKey: string,
): ReportDeliveryReceipt {
  const receipt = parseEnvelope(value, "report delivery receipt");
  if (
    receipt.reportId !== reportId ||
    receipt.recipientId !== recipientId ||
    receipt.idempotencyKey !== idempotencyKey
  ) {
    throw new RangeError("report delivery receipt does not match the requested recipient delivery");
  }
  return { reportId, recipientId, idempotencyKey };
}

/**
 * authority read（DeliveryLogStore）の三値 parse。null = absent、
 * status pending = 送信済み不明（自動再送禁止）、status sent = receipt 束縛検証。
 */
export function parseReportDeliveryLedgerStatus(
  value: unknown,
  reportId: string,
  recipientId: string,
  idempotencyKey: string,
): ReportDeliveryLedgerStatus {
  if (value === null) return { status: "absent" };
  const payload = parseEnvelope(value, "report delivery ledger status");
  if (payload.reportId !== reportId || payload.recipientId !== recipientId) {
    throw new RangeError("report delivery ledger status does not match the requested recipient");
  }
  if (payload.status === "pending") return { status: "pending" };
  if (payload.status === "sent") {
    return {
      status: "sent",
      receipt: parseReportDeliveryReceipt(value, reportId, recipientId, idempotencyKey),
    };
  }
  throw new RangeError("report delivery ledger status must be pending or sent");
}
