/**
 * packages/server/src/lib/confirmToken.ts
 *
 * 根拠: ADR-0006（コーディングタスク指示フロー「誤発火防止のため人間の明示クリック必須」）。
 *   Teams/WebUIからのcode_task指示は即座にworkflow_dispatchせず、確認リンク（taskId + token）を
 *   発行し、人間がそのリンクをクリック（GET→確認画面表示→POSTで実行）した場合のみ
 *   GitHub Actionsを起動する。tokenはtaskIdに対するHMAC-SHA256署名であり、
 *   (a) 第三者がtaskIdを推測してURLを偽造できないこと、(b) 改ざん検知、を担保する。
 *
 * lib/agents分離（CLAUDE.md原則1）: 本モジュールは外部API・DB・LLMに依存しない純粋関数のみで構成する。
 *   既存 packages/shared/src/clients/githubClient.ts の verifyGithubWebhookSignature
 *   （HMAC-SHA256 + crypto.timingSafeEqualによるタイミング攻撃対策）と同一パターンを踏襲する。
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** taskIdに対するHMAC-SHA256確認トークンを生成する（hex文字列）。 */
export function generateConfirmToken(taskId: string, secret: string): string {
  return createHmac("sha256", secret).update(taskId, "utf8").digest("hex");
}

/**
 * 確認トークンを検証する。taskIdと secret から再計算した値と定数時間比較する
 * （crypto.timingSafeEqualでタイミング攻撃対策。githubClient.tsのverifyGithubWebhookSignature踏襲）。
 * 改ざん・別taskId向けトークンの流用のいずれも拒否する。
 */
export function verifyConfirmToken(taskId: string, token: string, secret: string): boolean {
  if (!token) return false;
  const expected = generateConfirmToken(taskId, secret);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(token, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * DB保存用に確認トークンをハッシュ化する（SHA-256）。coding_tasks.confirm_token_hash列に保存する値。
 * 平文トークンをDBへ保存しない（DB漏洩時に確認リンクを再構成されることを防ぐ、多層防御）。
 * トークン自体はtaskId+secretから決定的に再生成できるため、ハッシュの照合はconfirm操作の
 * 監査証跡として保持する用途であり、認可判定自体はverifyConfirmTokenが担う。
 */
export function hashConfirmToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Bearerトークン形式のシークレット比較を定数時間で行う（security-reviewer指摘: 高。
 * codingTasks.tsのcallbackルートが従来 `authHeader !== expected` という非定数時間比較を
 * 使っており、他の認証比較（本ファイル・verifyGithubWebhookSignature）と異なりタイミング
 * 攻撃に対して脆弱だったため、同一パターンで統一する）。
 */
export function verifyBearerToken(authHeader: string, secret: string): boolean {
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(authHeader, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
