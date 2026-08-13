// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / ADR-0020
// 非冪等外部書き込みの idempotency key を workflow ID から決定的に構築する。
// 同一 (workflowId, activityName, sequence) は常に同一 key（TMP-003 の基盤）。
// 純粋関数のみ。時刻・乱数・I/O を使わない。

const ACTIVITY_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9]{0,99}$/u;

/**
 * 外部副作用 1 回分の idempotency key。sequence は workflow 内の
 * 決定的な通し番号（ループ回数など replay で再現される値）を渡す。
 */
export function buildIdempotencyKey(workflowId: string, activityName: string, sequence: number): string {
  if (workflowId.length === 0 || workflowId.includes("#")) {
    throw new RangeError(`workflow ID must be non-empty and must not contain "#" (got ${JSON.stringify(workflowId)})`);
  }
  if (!ACTIVITY_NAME_PATTERN.test(activityName)) {
    throw new RangeError(
      `activity name must match ${ACTIVITY_NAME_PATTERN.source} (got ${JSON.stringify(activityName)})`,
    );
  }
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new RangeError(`sequence must be a non-negative safe integer (got ${String(sequence)})`);
  }
  return `${workflowId}#${activityName}#${String(sequence)}`;
}

/** idempotency key を構成要素に分解する。buildIdempotencyKey の逆関数。 */
export function parseIdempotencyKey(key: string): {
  workflowId: string;
  activityName: string;
  sequence: number;
} {
  const lastHash = key.lastIndexOf("#");
  const middleHash = key.lastIndexOf("#", lastHash - 1);
  if (middleHash <= 0 || lastHash <= middleHash + 1) {
    throw new RangeError(`idempotency key must be "<workflowId>#<activity>#<sequence>" (got ${JSON.stringify(key)})`);
  }
  const workflowId = key.slice(0, middleHash);
  const activityName = key.slice(middleHash + 1, lastHash);
  const sequenceText = key.slice(lastHash + 1);
  const sequence = Number(sequenceText);
  if (!/^\d+$/u.test(sequenceText) || !ACTIVITY_NAME_PATTERN.test(activityName) || !Number.isSafeInteger(sequence)) {
    throw new RangeError(`idempotency key has invalid components (got ${JSON.stringify(key)})`);
  }
  return { workflowId, activityName, sequence };
}
