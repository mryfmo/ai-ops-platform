/**
 * packages/server/tests/confirmToken.test.ts
 *
 * 根拠: ADR-0006（コーディングタスク確認リンクのHMAC-SHA256トークン生成・検証。
 *   「誤発火防止のため人間の明示クリック必須」を成立させる前提となる、タスクIDと確認トークンの
 *   対応関係の完全性・改ざん耐性を検証する）
 */
import { createHmac } from "node:crypto";
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

describe("confirm token expiry [ADR-0006]", () => {
  const secret = "s".repeat(32);
  const taskId = "11111111-1111-1111-1111-111111111111";

  it("発行直後のトークンは有効", () => {
    const now = 1_700_000_000_000;
    const token = generateConfirmToken(taskId, secret, now);
    expect(verifyConfirmToken(taskId, token, secret, { nowMs: now })).toBe(true);
  });

  it("TTLを過ぎたトークンは拒否する", () => {
    const issued = 1_700_000_000_000;
    const token = generateConfirmToken(taskId, secret, issued);
    const past = issued + 61 * 60_000;
    expect(verifyConfirmToken(taskId, token, secret, { nowMs: past, ttlMinutes: 60 })).toBe(false);
    expect(verifyConfirmToken(taskId, token, secret, { nowMs: issued + 59 * 60_000, ttlMinutes: 60 })).toBe(true);
  });

  it("発行時刻を書き換えても署名対象なので拒否される", () => {
    const issued = 1_700_000_000_000;
    const token = generateConfirmToken(taskId, secret, issued);
    const signature = token.slice(token.indexOf(".") + 1);
    const forged = `${issued + 10 * 60_000}.${signature}`;
    expect(verifyConfirmToken(taskId, forged, secret, { nowMs: issued })).toBe(false);
  });

  it("未来日付のトークンは拒否する", () => {
    const issued = 1_700_000_000_000;
    const token = generateConfirmToken(taskId, secret, issued);
    expect(verifyConfirmToken(taskId, token, secret, { nowMs: issued - 60_000 })).toBe(false);
  });

  it("形式不正・別taskId向けは従来どおり拒否する", () => {
    const now = 1_700_000_000_000;
    const token = generateConfirmToken(taskId, secret, now);
    expect(verifyConfirmToken(taskId, "no-separator", secret, { nowMs: now })).toBe(false);
    expect(verifyConfirmToken(taskId, `abc.${token.split(".")[1]}`, secret, { nowMs: now })).toBe(false);
    expect(verifyConfirmToken("22222222-2222-2222-2222-222222222222", token, secret, { nowMs: now })).toBe(false);
  });
});

describe("旧形式トークンの移行受け入れ [DevOps:REQ-028 / ADR-0006]", () => {
  const SECRET = "s".repeat(32);
  const TASK = "task-legacy";
  const legacy = createHmac("sha256", SECRET).update(TASK, "utf8").digest("hex");
  const createdAt = Date.parse("2026-08-05T00:00:00.000Z");

  it("作成時刻をTTL内に持つ旧形式リンクは受け付ける [DevOps:REQ-028]", () => {
    expect(
      verifyConfirmToken(TASK, legacy, SECRET, {
        issuedAtFallbackMs: createdAt,
        nowMs: createdAt + 60 * 60 * 1000,
      }),
    ).toBe(true);
  });

  it("旧形式でもTTLを超えたら失効する（無期限有効の抜け穴を残さない） [DevOps:REQ-028]", () => {
    expect(
      verifyConfirmToken(TASK, legacy, SECRET, {
        issuedAtFallbackMs: createdAt,
        nowMs: createdAt + 25 * 60 * 60 * 1000,
      }),
    ).toBe(false);
  });

  it("発行時刻を代替できない場合は旧形式を受け付けない [DevOps:REQ-028]", () => {
    expect(verifyConfirmToken(TASK, legacy, SECRET, { nowMs: createdAt })).toBe(false);
  });

  it("旧形式でも別taskId向けトークンの流用は拒否する [DevOps:REQ-028]", () => {
    expect(verifyConfirmToken("other-task", legacy, SECRET, { issuedAtFallbackMs: createdAt, nowMs: createdAt })).toBe(
      false,
    );
  });

  it("ドットを含まない不正な長さの文字列は拒否する [DevOps:REQ-028]", () => {
    expect(verifyConfirmToken(TASK, "deadbeef", SECRET, { issuedAtFallbackMs: createdAt, nowMs: createdAt })).toBe(
      false,
    );
  });
});
