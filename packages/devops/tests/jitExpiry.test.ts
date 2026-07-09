import { describe, it, expect } from "vitest";
import {
  maxGrantDurationMs,
  validateGrantRequest,
  isGrantExpired,
  canExtendWithoutReapproval,
} from "../src/lib/jitExpiry.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe("maxGrantDurationMs [TH-007]", () => {
  it("本番(内部)は8時間", () => {
    expect(maxGrantDurationMs("prod", "internal")).toBe(8 * HOUR);
  });
  it("開発(内部)は30日", () => {
    expect(maxGrantDurationMs("dev", "internal")).toBe(30 * DAY);
  });
  it("ステージング(内部)は30日", () => {
    expect(maxGrantDurationMs("staging", "internal")).toBe(30 * DAY);
  });
  it("外部企業は全環境で90日（本番でも90日、内部の8時間ルールより優先）", () => {
    expect(maxGrantDurationMs("prod", "external")).toBe(90 * DAY);
    expect(maxGrantDurationMs("dev", "external")).toBe(90 * DAY);
  });
});

describe("validateGrantRequest [AC-018a/b]", () => {
  it("本番8時間の申請は許可される", () => {
    const r = validateGrantRequest({ env: "prod", subjectType: "internal", requestedDurationMs: 8 * HOUR });
    expect(r.ok).toBe(true);
  });
  it("本番9時間の申請は拒否される", () => {
    const r = validateGrantRequest({ env: "prod", subjectType: "internal", requestedDurationMs: 9 * HOUR });
    expect(r.ok).toBe(false);
    expect(r.clampedDurationMs).toBe(8 * HOUR);
  });
  it("外部企業91日は拒否される", () => {
    const r = validateGrantRequest({ env: "staging", subjectType: "external", requestedDurationMs: 91 * DAY });
    expect(r.ok).toBe(false);
  });
});

describe("isGrantExpired [TH-007自動失効判定]", () => {
  it("有効期限前はfalse", () => {
    expect(isGrantExpired("2026-07-06T18:00:00Z", new Date("2026-07-06T17:00:00Z"))).toBe(false);
  });
  it("有効期限到達でtrue（8時間ちょうどの境界値）", () => {
    const grantedAt = Date.parse("2026-07-06T09:00:00Z");
    const expiresAt = new Date(grantedAt + 8 * HOUR).toISOString();
    const now = new Date(grantedAt + 8 * HOUR);
    expect(isGrantExpired(expiresAt, now)).toBe(true);
  });
});

describe("canExtendWithoutReapproval [AC-018b]", () => {
  it("常にfalse（再承認必須）", () => {
    expect(canExtendWithoutReapproval()).toBe(false);
  });
});
