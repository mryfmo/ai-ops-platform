// 根拠: FinalArch:FR-CP-004 / FinalArch:FR-CP-005 / TMP-003 / ADR-0021
// Graph subscription workflow の入力・activity 結果・schedule 時刻を決定的に検証する。

export const GRAPH_SUBSCRIPTION_RENEWAL_MARGIN_MS = 6 * 60 * 60_000;
export const GRAPH_SUBSCRIPTION_DELTA_INTERVAL_MS = 5 * 60_000;
export const GRAPH_SUBSCRIPTION_RECONCILE_INTERVAL_MS = 5 * 60_000;
export const GRAPH_SUBSCRIPTION_TARGET_LIFETIME_MS = 4_315 * 60_000;

export type GraphSubscriptionOperation = "renewal" | "delta" | "reconcile";

interface GraphSubscriptionRequestBase {
  readonly subscriptionId: string;
  readonly operation: GraphSubscriptionOperation;
  readonly sequence: number;
  /** shadow は外部 write を必ず抑止。active は legacy writer の cutover 後だけ使用する。 */
  readonly executionMode: "shadow" | "active";
}

export interface GraphSubscriptionRenewalRequest extends GraphSubscriptionRequestBase {
  readonly operation: "renewal";
  readonly observedAtMs: number;
  readonly expiresAtMs: number;
}

export interface GraphSubscriptionRenewalActivityInput extends GraphSubscriptionRequestBase {
  readonly operation: "renewal";
  readonly observedAtMs: number;
  readonly targetExpiresAtMs: number;
}

export interface GraphSubscriptionScheduledRequest extends GraphSubscriptionRequestBase {
  readonly operation: "delta" | "reconcile";
  readonly observedAtMs: number;
}

export type GraphSubscriptionRequest = GraphSubscriptionRenewalRequest | GraphSubscriptionScheduledRequest;

export interface GraphSubscriptionReceipt {
  readonly subscriptionId: string;
  readonly operation: GraphSubscriptionOperation;
  readonly checkpoint: string;
}

// 最大 operation (9) + separators (2) + max safe integer (16) と合わせて
// buildWorkflowId の business-key 上限 200 以内に収める。
const SUBSCRIPTION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,172}$/u;
const OPERATIONS: readonly string[] = ["renewal", "delta", "reconcile"];

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Temporal payload は runtime では unknown のため、参照前に envelope 全体を検証する。 */
export function assertGraphSubscriptionRequest(input: unknown): asserts input is {
  schemaVersion: 1;
  payload: GraphSubscriptionRequest;
} {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new RangeError("graph subscription request must be a VersionedPayload object");
  }
  const envelope = input as { schemaVersion?: unknown; payload?: unknown };
  if (envelope.schemaVersion !== 1 || typeof envelope.payload !== "object" || envelope.payload === null) {
    throw new RangeError("graph subscription request must use schemaVersion 1 with an object payload");
  }
  const payload = envelope.payload as Record<string, unknown>;
  if (typeof payload.subscriptionId !== "string" || !SUBSCRIPTION_ID_PATTERN.test(payload.subscriptionId)) {
    throw new RangeError("subscriptionId must be a canonical nonblank identifier");
  }
  if (typeof payload.operation !== "string" || !OPERATIONS.includes(payload.operation)) {
    throw new RangeError("operation must be renewal, delta, or reconcile");
  }
  if (!isSafeNonNegativeInteger(payload.sequence)) {
    throw new RangeError("sequence must be a non-negative safe integer");
  }
  if (payload.executionMode !== "shadow" && payload.executionMode !== "active") {
    throw new RangeError("executionMode must be shadow or active");
  }
  if (!isSafeNonNegativeInteger(payload.observedAtMs)) {
    throw new RangeError("observedAtMs must be a non-negative safe integer");
  }
  if (payload.operation === "renewal") {
    if (
      !isSafeNonNegativeInteger(payload.observedAtMs) ||
      !isSafeNonNegativeInteger(payload.expiresAtMs) ||
      payload.expiresAtMs < payload.observedAtMs
    ) {
      throw new RangeError("renewal timestamps must be safe integers and expiry must not precede observation");
    }
  }
}

/** 旧 scheduler の 6h renew margin / 5m polling cadence を durable timer に写像する。 */
export function graphSubscriptionScheduleDelayMs(request: GraphSubscriptionRequest, currentTimeMs: number): number {
  if (!isSafeNonNegativeInteger(currentTimeMs))
    throw new RangeError("currentTimeMs must be a non-negative safe integer");
  if (request.operation === "renewal") {
    return Math.max(0, request.expiresAtMs - currentTimeMs - GRAPH_SUBSCRIPTION_RENEWAL_MARGIN_MS);
  }
  const interval =
    request.operation === "delta" ? GRAPH_SUBSCRIPTION_DELTA_INTERVAL_MS : GRAPH_SUBSCRIPTION_RECONCILE_INTERVAL_MS;
  return Math.max(0, request.observedAtMs + interval - currentTimeMs);
}

/** activity の unknown 結果を要求中の subscription/operation に束縛する。 */
export function parseGraphSubscriptionReceipt(
  value: unknown,
  subscriptionId: string,
  operation: GraphSubscriptionOperation,
): GraphSubscriptionReceipt {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RangeError("graph subscription activity receipt must use schemaVersion 1 with an object payload");
  }
  const envelope = value as { schemaVersion?: unknown; payload?: unknown };
  if (envelope.schemaVersion !== 1 || typeof envelope.payload !== "object" || envelope.payload === null) {
    throw new RangeError("graph subscription activity receipt must use schemaVersion 1 with an object payload");
  }
  const receipt = envelope.payload as Record<string, unknown>;
  if (
    receipt.subscriptionId !== subscriptionId ||
    receipt.operation !== operation ||
    typeof receipt.checkpoint !== "string" ||
    receipt.checkpoint.trim().length === 0
  ) {
    throw new RangeError("graph subscription activity receipt does not match the scheduled operation");
  }
  return { subscriptionId, operation, checkpoint: receipt.checkpoint };
}

export function parseOptionalGraphSubscriptionReceipt(
  value: unknown,
  subscriptionId: string,
  operation: GraphSubscriptionOperation,
): GraphSubscriptionReceipt | null {
  return value === null ? null : parseGraphSubscriptionReceipt(value, subscriptionId, operation);
}
