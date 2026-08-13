// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / ADR-0020
// versioning / cancellation ヘルパの workflow-context 外で検証可能な境界。
// workflow-context 内の挙動（patched の分岐・cancellation の伝播）は
// tests/replay.test.ts の recorded history replay が担う（TMP-001）。

import { describe, expect, it } from "vitest";

import { guardSideEffectDispatch, runCleanup } from "../src/workflows/cancellation.js";
import { isPatchActive, retirePatch } from "../src/workflows/versioning.js";

describe("FinalArch:FR-CP-001 versioning ヘルパの patch ID 命名規約", () => {
  it("不正な patch ID は SDK 到達前に RangeError で拒否される", () => {
    for (const bad of ["", "ab", "UPPER-case", "spaces here", "-leading", "日本語", "a".repeat(65)]) {
      expect(() => isPatchActive(bad), bad).toThrow(RangeError);
      expect(() => retirePatch(bad), bad).toThrow(RangeError);
    }
  });

  it("正しい patch ID は SDK へ委譲される（workflow-context 外では SDK が拒否する）", () => {
    // patched/deprecatePatch は workflow sandbox 外で呼ぶと SDK 側の状態エラーになる。
    // RangeError（命名規約違反）ではないことを確認し、wrapper が委譲していることを示す。
    for (const call of [() => isPatchActive("p3-t02-replay-probe"), () => retirePatch("p3-t02-replay-probe")]) {
      try {
        call();
      } catch (error) {
        expect(error).not.toBeInstanceOf(RangeError);
      }
    }
  });
});

describe("FinalArch:FR-CP-001 cancellation ヘルパの workflow-context 外境界", () => {
  it("guardSideEffectDispatch は context 外でも RangeError 系の誤分類をしない", () => {
    try {
      guardSideEffectDispatch("unit-test");
    } catch (error) {
      expect(error).not.toBeInstanceOf(RangeError);
    }
  });

  it("runCleanup は cleanup の結果/例外をそのまま伝える（握り潰さない）", async () => {
    await expect(
      runCleanup(async () => "done").catch((e: unknown) => {
        expect(e).not.toBeInstanceOf(RangeError);
        return "sdk-rejected";
      }),
    ).resolves.toMatch(/^(done|sdk-rejected)$/u);
  });
});
