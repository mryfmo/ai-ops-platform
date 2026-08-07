/**
 * packages/server/src/lib/auditLogPrivilege.ts
 *
 * 根拠: DevOps:REQ-028（監査ログは追記専用）/ ADR-0005。
 *   schema.sql の REVOKE/GRANT は `app_role` が存在する場合にのみ実行される DO ブロックの中にある。
 *   ロールが無ければ黙ってスキップされ、アプリ接続がテーブルオーナー相当のまま起動する。
 *   その状態では `DROP TRIGGER audit_log_block_update_delete` の一文で改変防止を外せるため、
 *   「追記専用」はDB権限で強制されているという前提が崩れる（所見 ADV-SEC-005）。
 *
 *   スキーマ適用時ではなく**接続しているロールの実権限**を見る。誰がどう適用したかに関わらず、
 *   実際に UPDATE/DELETE できてしまうかどうかだけが問題だからである。
 *
 * lib/agents分離（CLAUDE.md原則1）: 判定のみを純粋関数として置き、問い合わせは呼び出し側が行う。
 */

/** `has_table_privilege` の結果。superuser は常に true が返る点に注意（それも検出対象）。 */
export interface AuditLogPrivileges {
  canUpdate: boolean;
  canDelete: boolean;
}

export interface AuditLogPrivilegeVerdict {
  appendOnly: boolean;
  /** 追記専用が成立していない場合の理由。成立していれば undefined。 */
  reason?: string;
}

/**
 * 接続ロールが audit_log を追記専用としてしか扱えないかを判定する。
 *
 * トリガによる防御も併存するが、UPDATE/DELETE 権限を持つロールはトリガ自体を落とせるので、
 * 権限が無いことをもって初めて強制されていると言える。
 */
export function judgeAuditLogPrivilege(privileges: AuditLogPrivileges): AuditLogPrivilegeVerdict {
  const granted = [privileges.canUpdate ? "UPDATE" : undefined, privileges.canDelete ? "DELETE" : undefined].filter(
    (name): name is string => name !== undefined,
  );
  if (granted.length === 0) return { appendOnly: true };
  return {
    appendOnly: false,
    reason: `the connected role holds ${granted.join(" and ")} on audit_log; append-only enforcement is not in effect`,
  };
}
