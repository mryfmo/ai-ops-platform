/**
 * packages/shared/src/auditLog.ts
 *
 * 根拠:
 *   - PrjOps:REQ-020/021, PrjOps:SPEC-INT-053: 全エージェント入出力・人間介入を追記型で記録、改変不可、5年保持。
 *   - DevOps:REQ-028, SPEC-INT-056: 全エージェント判断・人間承認・権限操作を追記専用ログに記録、1年保持、
 *     UPDATE/DELETE権限をアプリロールに与えない。
 *
 * 設計方針:
 *   - AuditLogWriterインターフェースはappend()のみを公開し、update/deleteに相当するメソッドを一切持たない
 *     （型システムのレベルで改変不可を強制する。実運用ではGitのforce-push禁止・ブランチ保護、
 *     またはDBのREVOKE UPDATE/DELETEと組み合わせる。DOC-05 §7 / SPEC-INT-056参照）。
 *   - basisフィールドは「適用した閾値ID・要件ID等」を記録し、根拠までの遡及可能性（AC-020-1, AC-028a）を担保する。
 *   - レコードはJSONLとして永続化する想定（1行1レコード、追記のみ）。本モジュールはフォーマットと
 *     インメモリ/ファイルの2実装を提供する。
 */
import { sanitizeSecrets } from "./secretSanitizer.js";

export interface AuditRecord {
  log_id?: number; // BIGSERIAL相当。ファイル実装ではappend順のインデックスを採番する
  trace_id: string;
  actor: string; // "AGT-xxx" または ユーザーID(ST-nnn等)
  action: string;
  basis: string; // 適用した閾値ID・要件ID等。例: "TH-003(a)", "REQ-007"
  detail: unknown; // JSON化可能な詳細情報（構造化）
  reason?: string; // 上書き・削除等、理由必須操作の理由文（PrjOps:REQ-021 AC-021-1）
  at: string; // ISO 8601 + JST offset
}

export interface AuditLogWriter {
  append(record: Omit<AuditRecord, "log_id">): Promise<AuditRecord>;
  readAll(): Promise<AuditRecord[]>;
}

/** 理由が必須な操作の種別（PrjOps:REQ-021 AC-021-1: 理由未入力の上書き・削除操作はUIレベルで完了できない） */
export const REASON_REQUIRED_ACTIONS = new Set([
  "status_override", // PrjOps: /status override コマンド
  "issue_close", // PrjOps: /issue close コマンド
  "logical_delete", // PrjOps: 正本データの論理削除 (PRF-03のみ)
  "grant_revoke_manual_override", // DevOps: 手動権限変更の検出時の是正
  "approval_reject", // 承認差し戻し（コメント必須, PrjOps:SPEC-EXT-024 / DevOps:SPEC-EXT-010）
]);

export function validateReasonRequirement(action: string, reason: string | undefined): void {
  if (REASON_REQUIRED_ACTIONS.has(action) && (!reason || reason.trim().length === 0)) {
    throw new Error(
      `E-AUD01: action "${action}" requires a non-empty reason (PrjOps:REQ-021 AC-021-1 / PrjOps:SPEC-EXT-024)`,
    );
  }
}

/** インメモリ実装（単体テスト・ローカル開発用） */
export class InMemoryAuditLog implements AuditLogWriter {
  private records: AuditRecord[] = [];

  async append(record: Omit<AuditRecord, "log_id">): Promise<AuditRecord> {
    validateReasonRequirement(record.action, record.reason);
    const detailStr = JSON.stringify(record.detail);
    const { redactionCount } = sanitizeSecrets(detailStr);
    if (redactionCount > 0) {
      // PrjOps:REQ-032 / DevOps:REQ-030: シークレットが混入していた場合は例外を出し、呼び出し側にサニタイズを強制する
      throw new Error(
        `E-AUD02: refusing to write audit record containing ${redactionCount} secret-like pattern(s). Sanitize before writing (PrjOps:REQ-032/DevOps:SPEC-INT-070).`,
      );
    }
    const full: AuditRecord = { ...record, log_id: this.records.length + 1 };
    this.records.push(full);
    return full;
  }

  async readAll(): Promise<AuditRecord[]> {
    return [...this.records];
  }
}

/** JSONL（追記型ファイル）実装。GitHub Actions実行環境では prjops-reports/audit や DevOps audit_log ストアに相当。 */
export class JsonlAuditLog implements AuditLogWriter {
  constructor(
    private readonly appendFn: (line: string) => Promise<void>,
    private readonly readAllFn: () => Promise<string[]>,
  ) {}

  async append(record: Omit<AuditRecord, "log_id">): Promise<AuditRecord> {
    validateReasonRequirement(record.action, record.reason);
    const detailStr = JSON.stringify(record.detail);
    const { redactionCount } = sanitizeSecrets(detailStr);
    if (redactionCount > 0) {
      throw new Error(
        `E-AUD02: refusing to write audit record containing ${redactionCount} secret-like pattern(s). Sanitize before writing (PrjOps:REQ-032/DevOps:SPEC-INT-070).`,
      );
    }
    const existing = await this.readAllFn();
    const full: AuditRecord = { ...record, log_id: existing.length + 1 };
    await this.appendFn(JSON.stringify(full));
    return full;
  }

  async readAll(): Promise<AuditRecord[]> {
    const lines = await this.readAllFn();
    return lines.filter((l) => l.trim().length > 0).map((l) => JSON.parse(l) as AuditRecord);
  }
}

/**
 * 監査ログから、あるレポート内の任意の数値の根拠まで遡れることを検証するためのヘルパ
 * （PrjOps:AC-020-1: 「任意のレポート内の任意の数値について、根拠となる元報告まで遡れる」）。
 */
export function findTraceChain(records: AuditRecord[], traceId: string): AuditRecord[] {
  return records.filter((r) => r.trace_id === traceId).sort((a, b) => (a.log_id ?? 0) - (b.log_id ?? 0));
}
