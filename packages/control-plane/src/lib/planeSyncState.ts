// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / FinalArch:CON-002 / TMP-003 / ADR-0020 / ADR-0023
// Plane sync（projection / event / promotion）の入力・receipt を決定的に検証する
// 純粋関数。正典 component spec 08: dedupe 恒等は (external_source, external_id,
// project_id, mapping_version)、promotion は baseline revision 固定 + draft まで、
// Plane 側の操作境界は operationBoundary（read + draft）を activity 契約で維持する。

export type PlaneSyncExecutionMode = "shadow" | "active";

/** dedupe 恒等（正典 Dedupe 節の 4 要素）。 */
export interface PlaneSyncIdentity {
  readonly externalSource: string;
  readonly externalId: string;
  readonly projectId: string;
  readonly mappingVersion: number;
}

export interface PlaneSyncRequest extends PlaneSyncIdentity {
  readonly executionMode: PlaneSyncExecutionMode;
  readonly operations: readonly PlaneSyncOperation[];
}

export type PlaneSyncOperation = "projection" | "event" | "promotion";

/** projection / event の write receipt。dedupe 恒等 + idempotency key に束縛。 */
export interface PlaneSyncWriteReceipt extends PlaneSyncIdentity {
  readonly idempotencyKey: string;
}

/** promotion の適格性 receipt（authoritative read）。 */
export interface PlanePromotionEligibility extends PlaneSyncIdentity {
  readonly engineeringReady: boolean;
  readonly approved: boolean;
  /** read 時点の work item revision。promotion はこの値を baseline として固定する。 */
  readonly baselineRevision: string;
}

/** promotion の draft receipt。baseline echo + draft 性の明示束縛。 */
export interface PlanePromotionDraftReceipt extends PlaneSyncIdentity {
  readonly idempotencyKey: string;
  readonly baselineRevision: string;
  /** 正典 + operationBoundary: draft PR/Issue まで。formal publish は不可。 */
  readonly draft: true;
}

const SOURCE_PATTERN = /^[a-z][a-z0-9-]{1,40}$/u;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,150}$/u;
const REVISION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,100}$/u;
const OPERATIONS: readonly string[] = ["projection", "event", "promotion"];

function assertIdentity(payload: Record<string, unknown>): void {
  if (typeof payload.externalSource !== "string" || !SOURCE_PATTERN.test(payload.externalSource)) {
    throw new RangeError("externalSource must be a canonical source identifier");
  }
  if (typeof payload.externalId !== "string" || !ID_PATTERN.test(payload.externalId)) {
    throw new RangeError("externalId must be a canonical identifier");
  }
  if (typeof payload.projectId !== "string" || !ID_PATTERN.test(payload.projectId)) {
    throw new RangeError("projectId must be a canonical identifier");
  }
  if (!Number.isSafeInteger(payload.mappingVersion) || (payload.mappingVersion as number) < 1) {
    throw new RangeError("mappingVersion must be a positive safe integer");
  }
}

function identityMatches(receipt: Record<string, unknown>, identity: PlaneSyncIdentity): boolean {
  return (
    receipt.externalSource === identity.externalSource &&
    receipt.externalId === identity.externalId &&
    receipt.projectId === identity.projectId &&
    receipt.mappingVersion === identity.mappingVersion
  );
}

/** Temporal payload は runtime では unknown のため、封筒全体を参照前に検証する。 */
export function assertPlaneSyncRequest(input: unknown): asserts input is {
  schemaVersion: 1;
  payload: PlaneSyncRequest;
} {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new RangeError("plane sync request must be a VersionedPayload object");
  }
  const envelope = input as { schemaVersion?: unknown; payload?: unknown };
  if (envelope.schemaVersion !== 1 || typeof envelope.payload !== "object" || envelope.payload === null) {
    throw new RangeError("plane sync request must use schemaVersion 1 with an object payload");
  }
  const payload = envelope.payload as Record<string, unknown>;
  assertIdentity(payload);
  if (payload.executionMode !== "shadow" && payload.executionMode !== "active") {
    throw new RangeError("executionMode must be shadow or active");
  }
  if (!Array.isArray(payload.operations) || payload.operations.length === 0) {
    throw new RangeError("operations must be a non-empty array");
  }
  const seen = new Set<string>();
  for (const operation of payload.operations as unknown[]) {
    if (typeof operation !== "string" || !OPERATIONS.includes(operation)) {
      throw new RangeError("operations must contain only projection, event, or promotion");
    }
    if (seen.has(operation)) {
      throw new RangeError(`operations must be unique (duplicate ${JSON.stringify(operation)})`);
    }
    seen.add(operation);
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

export function parsePlaneSyncWriteReceipt(
  value: unknown,
  identity: PlaneSyncIdentity,
  idempotencyKey: string,
): PlaneSyncWriteReceipt {
  const receipt = parseEnvelope(value, "plane sync write receipt");
  if (!identityMatches(receipt, identity) || receipt.idempotencyKey !== idempotencyKey) {
    throw new RangeError("plane sync write receipt does not match the requested identity");
  }
  return { ...identity, idempotencyKey };
}

/** authority read の三値（P3-T07-002 の恒久則を踏襲: pending は成功でも不在でもない）。 */
export type PlaneSyncLedgerStatus =
  | { readonly status: "written"; readonly receipt: PlaneSyncWriteReceipt }
  | { readonly status: "pending" }
  | { readonly status: "absent" };

export function parsePlaneSyncLedgerStatus(
  value: unknown,
  identity: PlaneSyncIdentity,
  idempotencyKey: string,
): PlaneSyncLedgerStatus {
  if (value === null) return { status: "absent" };
  const payload = parseEnvelope(value, "plane sync ledger status");
  if (!identityMatches(payload, identity)) {
    throw new RangeError("plane sync ledger status does not match the requested identity");
  }
  if (payload.status === "pending") return { status: "pending" };
  if (payload.status === "written") {
    return { status: "written", receipt: parsePlaneSyncWriteReceipt(value, identity, idempotencyKey) };
  }
  throw new RangeError("plane sync ledger status must be pending or written");
}

export function parsePlanePromotionEligibility(value: unknown, identity: PlaneSyncIdentity): PlanePromotionEligibility {
  const receipt = parseEnvelope(value, "plane promotion eligibility");
  if (
    !identityMatches(receipt, identity) ||
    typeof receipt.engineeringReady !== "boolean" ||
    typeof receipt.approved !== "boolean" ||
    typeof receipt.baselineRevision !== "string" ||
    !REVISION_PATTERN.test(receipt.baselineRevision)
  ) {
    throw new RangeError("plane promotion eligibility does not match the requested identity");
  }
  return {
    ...identity,
    engineeringReady: receipt.engineeringReady,
    approved: receipt.approved,
    baselineRevision: receipt.baselineRevision,
  };
}

/** 現行 revision の read。stale 判定は workflow が baseline と比較して行う。 */
export function parsePlaneRevisionReceipt(value: unknown, identity: PlaneSyncIdentity): string {
  const receipt = parseEnvelope(value, "plane revision receipt");
  if (
    !identityMatches(receipt, identity) ||
    typeof receipt.revision !== "string" ||
    !REVISION_PATTERN.test(receipt.revision)
  ) {
    throw new RangeError("plane revision receipt does not match the requested identity");
  }
  return receipt.revision;
}

/**
 * promotion draft receipt。baseline echo の不一致・draft 明示の欠如は拒否
 * （operationBoundary の draft 境界と正典「draft PR/Issue まで」の機械的束縛）。
 */
export function parsePlanePromotionDraftReceipt(
  value: unknown,
  identity: PlaneSyncIdentity,
  idempotencyKey: string,
  baselineRevision: string,
): PlanePromotionDraftReceipt {
  const receipt = parseEnvelope(value, "plane promotion draft receipt");
  if (
    !identityMatches(receipt, identity) ||
    receipt.idempotencyKey !== idempotencyKey ||
    receipt.baselineRevision !== baselineRevision ||
    receipt.draft !== true
  ) {
    throw new RangeError("plane promotion draft receipt must echo the pinned baseline and declare draft-only output");
  }
  return { ...identity, idempotencyKey, baselineRevision, draft: true };
}
