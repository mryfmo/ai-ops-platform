// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / PrjOps:SPEC-INT-052 / TMP-003 / ADR-0020
// report delivery workflow の入力・activity receipt を決定的に検証する純粋関数。
// 権威の正本は複製しない: 配信冪等は DeliveryLogStore（reportId::recipientId）、
// 承認は approvalsRepo（P3-T03 child）、権限は reportPermissionFilter（配信時・
// リクエスト毎）。ここは unknown 受けの形検証と束縛のみを担う。

export type ReportDeliveryExecutionMode = "shadow" | "active";

export interface ReportRecipient {
  readonly recipientId: string;
}

export interface ReportDeliveryRequest {
  readonly reportId: string;
  readonly approvalId: string;
  readonly approvalVersion: number;
  readonly approvalExpiryMs: number;
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
  if (typeof payload.approvalId !== "string" || !UUID_PATTERN.test(payload.approvalId)) {
    throw new RangeError("approvalId must be a lowercase UUID");
  }
  if (!Number.isSafeInteger(payload.approvalVersion) || (payload.approvalVersion as number) < 1) {
    throw new RangeError("approvalVersion must be a positive safe integer");
  }
  if (!Number.isSafeInteger(payload.approvalExpiryMs) || (payload.approvalExpiryMs as number) < 1) {
    throw new RangeError("approvalExpiryMs must be a positive safe integer");
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

export function parseOptionalReportDeliveryReceipt(
  value: unknown,
  reportId: string,
  recipientId: string,
  idempotencyKey: string,
): ReportDeliveryReceipt | null {
  return value === null ? null : parseReportDeliveryReceipt(value, reportId, recipientId, idempotencyKey);
}
