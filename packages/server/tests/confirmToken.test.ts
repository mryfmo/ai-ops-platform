/**
 * packages/server/tests/confirmToken.test.ts
 *
 * 根拠: ADR-0006（コーディングタスク確認リンクのHMAC-SHA256トークン生成・検証。
 *   「誤発火防止のため人間の明示クリック必須」を成立させる前提となる、タスクIDと確認トークンの
 *   対応関係の完全性・改ざん耐性を検証する）
 */
import { describe, it, expect } from "vitest";
import { generateConfirmToken, verifyConfirmToken, hashConfirmToken } from "../src/lib/confirmToken.js";

const SECRET = "test-confirm-token-secret-16chars";
const TASK_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_TASK_ID = "22222222-2222-4222-8222-222222222222";

describe("confirmToken (ADR-0006)", () => {
  it("generateConfirmToken→verifyConfirmTokenで生成直後のトークンは検証成功する", () => {
    const token = generateConfirmToken(TASK_ID, SECRET);
    expect(verifyConfirmToken(TASK_ID, token, SECRET)).toBe(true);
  });

  it("改ざんされたトークンは拒否される", () => {
    const token = generateConfirmToken(TASK_ID, SECRET);
    const tampered = token.slice(0, -1) + (token.at(-1) === "0" ? "1" : "0");
    expect(verifyConfirmToken(TASK_ID, tampered, SECRET)).toBe(false);
  });

  it("別のtaskId向けに発行されたトークンは拒否される（流用防止）", () => {
    const tokenForOther = generateConfirmToken(OTHER_TASK_ID, SECRET);
    expect(verifyConfirmToken(TASK_ID, tokenForOther, SECRET)).toBe(false);
  });

  it("異なるsecretで生成したトークンは拒否される", () => {
    const token = generateConfirmToken(TASK_ID, SECRET);
    expect(verifyConfirmToken(TASK_ID, token, "different-secret-16chars")).toBe(false);
  });

  it("空文字トークンは拒否される", () => {
    expect(verifyConfirmToken(TASK_ID, "", SECRET)).toBe(false);
  });

  it("hashConfirmToken: 同一トークンは同一ハッシュ、異なるトークンは異なるハッシュ", () => {
    const token = generateConfirmToken(TASK_ID, SECRET);
    const other = generateConfirmToken(OTHER_TASK_ID, SECRET);
    expect(hashConfirmToken(token)).toBe(hashConfirmToken(token));
    expect(hashConfirmToken(token)).not.toBe(hashConfirmToken(other));
  });

  it("hashConfirmTokenは平文トークンをそのまま返さない（DB保存用ハッシュ化）", () => {
    const token = generateConfirmToken(TASK_ID, SECRET);
    expect(hashConfirmToken(token)).not.toBe(token);
  });
});
