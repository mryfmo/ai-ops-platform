/**
 * packages/server/src/db/pgAuditLog.ts
 *
 * 根拠:
 *   - DevOps:SPEC-INT-056 / REQ-028: audit_logテーブルは追記専用（INSERT/SELECTのみ。
 *     UPDATE/DELETE権限はアプリロールに付与しない。schema.sqlのREVOKEコメント参照）。
 *   - ADR-0005: 常駐サーバの監査ログはPostgreSQL実装を正本とする。
 *
 * 設計: shared の AuditLogWriter インターフェースに準拠（append/readAllのみ）。
 *   理由必須検証（validateReasonRequirement）とシークレット混入検査（E-AUD02）は
 *   InMemoryAuditLog / JsonlAuditLog と同一のガードを適用する。
 */
export { PgAuditLog } from "@aiops/shared";
