// 根拠: 添付TEXT「Jira・GitHub・ai-ops-platform構成」 / TMP-003 / ADR-0020
// Jira sync の入力・baseline・receipt を決定的に検証する純粋関数。
// - Jira の正本: Work Item の Status / Assignee / Sprint
// - stale 判定: updated + statusId + fieldHash の三要素
// - protected write: 明示 approval UUID + authoritative read + write authority CAS
// - GitHub への昇格: Draft PR まで。Approve / Merge / formal publish は到達不能

export type JiraSyncExecutionMode = "shadow" | "active";
export type JiraSyncOrigin = "jira-webhook" | "github-webhook" | "reconcile" | "operator";
export type JiraSyncOperation = "projection" | "event" | "promotion" | "transition";

export interface JiraSyncIdentity {
  readonly issueKey: string;
  readonly projectId: string;
  readonly mappingVersion: number;
  /** SHA-256(updated の ISO 正規形 + fieldHash)。同一 issue の event 世代を分離する。 */
  readonly revision: string;
}

export interface JiraIssueBaseline {
  readonly updated: string;
  readonly statusId: string;
  readonly fieldHash: string;
}

export interface JiraSyncRequest extends JiraSyncIdentity {
  readonly executionMode: JiraSyncExecutionMode;
  readonly origin: JiraSyncOrigin;
  readonly operations: readonly JiraSyncOperation[];
  /** promotion / protected transition の承認証跡。該当操作が無ければ指定不可。 */
  readonly approvalId?: string;
  /** transition 操作時だけ必須。Jira tenant 固有の status ID。 */
  readonly targetStatusId?: string;
}

export interface JiraSyncWriteReceipt extends JiraSyncIdentity {
  readonly operation: "projection" | "event";
  readonly idempotencyKey: string;
}

export interface JiraPromotionEligibility extends JiraSyncIdentity {
  readonly engineeringReady: boolean;
  readonly approved: boolean;
  readonly approvalId: string;
  readonly baseline: JiraIssueBaseline;
}

export interface JiraPromotionDraftReceipt extends JiraSyncIdentity {
  readonly operation: "promotion";
  readonly idempotencyKey: string;
  readonly approvalId: string;
  readonly baseline: JiraIssueBaseline;
  readonly draft: true;
}

export interface JiraTransitionAuthorization extends JiraSyncIdentity {
  readonly approved: boolean;
  readonly approvalId: string;
  readonly targetStatusId: string;
  readonly baseline: JiraIssueBaseline;
}

export interface JiraTransitionReceipt extends JiraSyncIdentity {
  readonly operation: "transition";
  readonly idempotencyKey: string;
  readonly approvalId: string;
  readonly targetStatusId: string;
  readonly baseline: JiraIssueBaseline;
  readonly transitioned: true;
}

const ISSUE_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,29}-[1-9][0-9]{0,9}$/u;
const PROJECT_ID_PATTERN = /^PJ-[0-9]+$/u;
const JIRA_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const HASH_PATTERN = /^[0-9a-f]{64}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ORIGINS: readonly string[] = ["jira-webhook", "github-webhook", "reconcile", "operator"];
const OPERATIONS: readonly string[] = ["projection", "event", "promotion", "transition"];

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RangeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function parseEnvelope(value: unknown, label: string): Record<string, unknown> {
  const envelope = record(value, label);
  if (envelope.schemaVersion !== 1) {
    throw new RangeError(`${label} must use schemaVersion 1`);
  }
  return record(envelope.payload, `${label}.payload`);
}

function assertApprovalId(value: unknown, label = "approvalId"): asserts value is string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new RangeError(`${label} must be a UUID`);
  }
}

function assertJiraId(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !JIRA_ID_PATTERN.test(value)) {
    throw new RangeError(`${label} must be a canonical Jira identifier`);
  }
}

function assertUpdated(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    !/[T ]/u.test(value) ||
    !/(?:Z|[+-][0-9]{2}:?[0-9]{2})$/u.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    throw new RangeError("baseline.updated must be a timestamp with timezone");
  }
}

export function assertJiraSyncIdentity(value: unknown): asserts value is JiraSyncIdentity {
  const identity = record(value, "jira sync identity");
  if (typeof identity.issueKey !== "string" || !ISSUE_KEY_PATTERN.test(identity.issueKey)) {
    throw new RangeError("issueKey must be a canonical Jira issue key");
  }
  if (typeof identity.projectId !== "string" || !PROJECT_ID_PATTERN.test(identity.projectId)) {
    throw new RangeError("projectId must be a canonical PJ-* identifier");
  }
  if (!Number.isSafeInteger(identity.mappingVersion) || (identity.mappingVersion as number) < 1) {
    throw new RangeError("mappingVersion must be a positive safe integer");
  }
  if (typeof identity.revision !== "string" || !HASH_PATTERN.test(identity.revision)) {
    throw new RangeError("revision must be lowercase SHA-256 hex");
  }
}

export function assertJiraIssueBaseline(value: unknown): asserts value is JiraIssueBaseline {
  const baseline = record(value, "jira issue baseline");
  assertUpdated(baseline.updated);
  assertJiraId(baseline.statusId, "baseline.statusId");
  if (typeof baseline.fieldHash !== "string" || !HASH_PATTERN.test(baseline.fieldHash)) {
    throw new RangeError("baseline.fieldHash must be lowercase SHA-256 hex");
  }
}

export function sameJiraIssueBaseline(left: JiraIssueBaseline, right: JiraIssueBaseline): boolean {
  return left.updated === right.updated && left.statusId === right.statusId && left.fieldHash === right.fieldHash;
}

export function assertJiraSyncRequest(input: unknown): asserts input is { schemaVersion: 1; payload: JiraSyncRequest } {
  const payload = parseEnvelope(input, "jira sync request");
  assertJiraSyncIdentity(payload);
  if (payload.executionMode !== "shadow" && payload.executionMode !== "active") {
    throw new RangeError("executionMode must be shadow or active");
  }
  if (typeof payload.origin !== "string" || !ORIGINS.includes(payload.origin)) {
    throw new RangeError("origin must be jira-webhook, github-webhook, reconcile, or operator");
  }
  if (!Array.isArray(payload.operations) || payload.operations.length === 0) {
    throw new RangeError("operations must be a non-empty array");
  }
  const seen = new Set<string>();
  for (const operation of payload.operations as unknown[]) {
    if (typeof operation !== "string" || !OPERATIONS.includes(operation)) {
      throw new RangeError("operations contains an unknown Jira sync operation");
    }
    if (seen.has(operation)) throw new RangeError(`operations must be unique (duplicate ${operation})`);
    seen.add(operation);
  }

  const protectedWrite = seen.has("promotion") || seen.has("transition");
  if (protectedWrite) assertApprovalId(payload.approvalId);
  else if (payload.approvalId !== undefined) {
    throw new RangeError("approvalId is only valid for promotion or transition");
  }

  if (seen.has("transition")) assertJiraId(payload.targetStatusId, "targetStatusId");
  else if (payload.targetStatusId !== undefined) {
    throw new RangeError("targetStatusId is only valid for transition");
  }
}

function identityMatches(value: Record<string, unknown>, identity: JiraSyncIdentity): boolean {
  return (
    value.issueKey === identity.issueKey &&
    value.projectId === identity.projectId &&
    value.mappingVersion === identity.mappingVersion &&
    value.revision === identity.revision
  );
}

function parseBaseline(value: unknown): JiraIssueBaseline {
  assertJiraIssueBaseline(value);
  return { updated: value.updated, statusId: value.statusId, fieldHash: value.fieldHash };
}

export function parseJiraSyncWriteReceipt(
  value: unknown,
  identity: JiraSyncIdentity,
  operation: "projection" | "event",
  idempotencyKey: string,
): JiraSyncWriteReceipt {
  const payload = parseEnvelope(value, "jira sync write receipt");
  if (
    !identityMatches(payload, identity) ||
    payload.operation !== operation ||
    payload.idempotencyKey !== idempotencyKey
  ) {
    throw new RangeError("jira sync write receipt does not match the requested operation and identity");
  }
  return { ...identity, operation, idempotencyKey };
}

export type JiraSyncLedgerStatus =
  | { readonly status: "written"; readonly receipt: JiraSyncWriteReceipt }
  | { readonly status: "pending" }
  | { readonly status: "absent" };

export function parseJiraSyncLedgerStatus(
  value: unknown,
  identity: JiraSyncIdentity,
  operation: "projection" | "event",
  idempotencyKey: string,
): JiraSyncLedgerStatus {
  if (value === null) return { status: "absent" };
  const payload = parseEnvelope(value, "jira sync ledger status");
  if (!identityMatches(payload, identity) || payload.operation !== operation) {
    throw new RangeError("jira sync ledger status does not match the requested operation and identity");
  }
  if (payload.status === "pending") return { status: "pending" };
  if (payload.status === "written") {
    return { status: "written", receipt: parseJiraSyncWriteReceipt(value, identity, operation, idempotencyKey) };
  }
  throw new RangeError("jira sync ledger status must be pending or written");
}

export function parseJiraPromotionEligibility(
  value: unknown,
  identity: JiraSyncIdentity,
  approvalId: string,
): JiraPromotionEligibility {
  assertApprovalId(approvalId);
  const payload = parseEnvelope(value, "jira promotion eligibility");
  if (
    !identityMatches(payload, identity) ||
    typeof payload.engineeringReady !== "boolean" ||
    typeof payload.approved !== "boolean" ||
    payload.approvalId !== approvalId
  ) {
    throw new RangeError("jira promotion eligibility does not match the requested identity and approval");
  }
  return {
    ...identity,
    engineeringReady: payload.engineeringReady,
    approved: payload.approved,
    approvalId,
    baseline: parseBaseline(payload.baseline),
  };
}

export function parseJiraBaselineReceipt(value: unknown, identity: JiraSyncIdentity): JiraIssueBaseline {
  const payload = parseEnvelope(value, "jira baseline receipt");
  if (!identityMatches(payload, identity)) {
    throw new RangeError("jira baseline receipt does not match the requested identity");
  }
  return parseBaseline(payload.baseline);
}

export function parseJiraPromotionDraftReceipt(
  value: unknown,
  identity: JiraSyncIdentity,
  idempotencyKey: string,
  approvalId: string,
  expectedBaseline: JiraIssueBaseline | null,
): JiraPromotionDraftReceipt {
  const payload = parseEnvelope(value, "jira promotion draft receipt");
  const baseline = parseBaseline(payload.baseline);
  if (
    !identityMatches(payload, identity) ||
    payload.operation !== "promotion" ||
    payload.idempotencyKey !== idempotencyKey ||
    payload.approvalId !== approvalId ||
    payload.draft !== true ||
    (expectedBaseline !== null && !sameJiraIssueBaseline(baseline, expectedBaseline))
  ) {
    throw new RangeError("jira promotion receipt must echo approval/baseline and declare draft-only output");
  }
  return { ...identity, operation: "promotion", idempotencyKey, approvalId, baseline, draft: true };
}

export type JiraPromotionLedgerStatus =
  | { readonly status: "written"; readonly receipt: JiraPromotionDraftReceipt }
  | { readonly status: "pending" }
  | { readonly status: "absent" };

export function parseJiraPromotionLedgerStatus(
  value: unknown,
  identity: JiraSyncIdentity,
  idempotencyKey: string,
  approvalId: string,
  expectedBaseline: JiraIssueBaseline | null,
): JiraPromotionLedgerStatus {
  if (value === null) return { status: "absent" };
  const payload = parseEnvelope(value, "jira promotion ledger status");
  if (!identityMatches(payload, identity) || payload.operation !== "promotion") {
    throw new RangeError("jira promotion ledger does not match the requested identity");
  }
  if (payload.status === "pending") return { status: "pending" };
  if (payload.status === "written") {
    return {
      status: "written",
      receipt: parseJiraPromotionDraftReceipt(value, identity, idempotencyKey, approvalId, expectedBaseline),
    };
  }
  throw new RangeError("jira promotion ledger status must be pending or written");
}

export type JiraPromotionWriteResult =
  | { readonly kind: "created"; readonly receipt: JiraPromotionDraftReceipt }
  | { readonly kind: "stale"; readonly observedBaseline: JiraIssueBaseline };

export function parseJiraPromotionWriteResult(
  value: unknown,
  identity: JiraSyncIdentity,
  idempotencyKey: string,
  approvalId: string,
  pinnedBaseline: JiraIssueBaseline,
): JiraPromotionWriteResult {
  const payload = parseEnvelope(value, "jira promotion write result");
  if (!identityMatches(payload, identity)) {
    throw new RangeError("jira promotion write result does not match the requested identity");
  }
  if (payload.result === "created") {
    return {
      kind: "created",
      receipt: parseJiraPromotionDraftReceipt(value, identity, idempotencyKey, approvalId, pinnedBaseline),
    };
  }
  if (payload.result === "stale") {
    const observedBaseline = parseBaseline(payload.observedBaseline);
    if (sameJiraIssueBaseline(observedBaseline, pinnedBaseline)) {
      throw new RangeError("stale Jira promotion result must observe a different baseline");
    }
    return { kind: "stale", observedBaseline };
  }
  throw new RangeError("jira promotion write result must be created or stale");
}

export function parseJiraTransitionAuthorization(
  value: unknown,
  identity: JiraSyncIdentity,
  approvalId: string,
  targetStatusId: string,
): JiraTransitionAuthorization {
  assertApprovalId(approvalId);
  assertJiraId(targetStatusId, "targetStatusId");
  const payload = parseEnvelope(value, "jira transition authorization");
  if (
    !identityMatches(payload, identity) ||
    typeof payload.approved !== "boolean" ||
    payload.approvalId !== approvalId ||
    payload.targetStatusId !== targetStatusId
  ) {
    throw new RangeError("jira transition authorization does not match the requested identity/status/approval");
  }
  return {
    ...identity,
    approved: payload.approved,
    approvalId,
    targetStatusId,
    baseline: parseBaseline(payload.baseline),
  };
}

export function parseJiraTransitionReceipt(
  value: unknown,
  identity: JiraSyncIdentity,
  idempotencyKey: string,
  approvalId: string,
  targetStatusId: string,
  expectedBaseline: JiraIssueBaseline,
): JiraTransitionReceipt {
  const payload = parseEnvelope(value, "jira transition receipt");
  const baseline = parseBaseline(payload.baseline);
  if (
    !identityMatches(payload, identity) ||
    payload.operation !== "transition" ||
    payload.idempotencyKey !== idempotencyKey ||
    payload.approvalId !== approvalId ||
    payload.targetStatusId !== targetStatusId ||
    payload.transitioned !== true ||
    !sameJiraIssueBaseline(baseline, expectedBaseline)
  ) {
    throw new RangeError("jira transition receipt must echo approval/status/baseline");
  }
  return {
    ...identity,
    operation: "transition",
    idempotencyKey,
    approvalId,
    targetStatusId,
    baseline,
    transitioned: true,
  };
}

export type JiraTransitionLedgerStatus =
  | { readonly status: "written"; readonly receipt: JiraTransitionReceipt }
  | { readonly status: "pending" }
  | { readonly status: "absent" };

export function parseJiraTransitionLedgerStatus(
  value: unknown,
  identity: JiraSyncIdentity,
  idempotencyKey: string,
  approvalId: string,
  targetStatusId: string,
  expectedBaseline: JiraIssueBaseline,
): JiraTransitionLedgerStatus {
  if (value === null) return { status: "absent" };
  const payload = parseEnvelope(value, "jira transition ledger status");
  if (!identityMatches(payload, identity) || payload.operation !== "transition") {
    throw new RangeError("jira transition ledger does not match the requested identity");
  }
  if (payload.status === "pending") return { status: "pending" };
  if (payload.status === "written") {
    return {
      status: "written",
      receipt: parseJiraTransitionReceipt(
        value,
        identity,
        idempotencyKey,
        approvalId,
        targetStatusId,
        expectedBaseline,
      ),
    };
  }
  throw new RangeError("jira transition ledger status must be pending or written");
}

export type JiraTransitionWriteResult =
  | { readonly kind: "transitioned"; readonly receipt: JiraTransitionReceipt }
  | { readonly kind: "stale"; readonly observedBaseline: JiraIssueBaseline };

export function parseJiraTransitionWriteResult(
  value: unknown,
  identity: JiraSyncIdentity,
  idempotencyKey: string,
  approvalId: string,
  targetStatusId: string,
  pinnedBaseline: JiraIssueBaseline,
): JiraTransitionWriteResult {
  const payload = parseEnvelope(value, "jira transition write result");
  if (!identityMatches(payload, identity)) {
    throw new RangeError("jira transition write result does not match the requested identity");
  }
  if (payload.result === "transitioned") {
    return {
      kind: "transitioned",
      receipt: parseJiraTransitionReceipt(value, identity, idempotencyKey, approvalId, targetStatusId, pinnedBaseline),
    };
  }
  if (payload.result === "stale") {
    const observedBaseline = parseBaseline(payload.observedBaseline);
    if (sameJiraIssueBaseline(observedBaseline, pinnedBaseline)) {
      throw new RangeError("stale Jira transition result must observe a different baseline");
    }
    return { kind: "stale", observedBaseline };
  }
  throw new RangeError("jira transition write result must be transitioned or stale");
}
