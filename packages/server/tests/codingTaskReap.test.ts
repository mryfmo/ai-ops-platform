/**
 * packages/server/tests/codingTaskReap.test.ts
 *
 * 根拠: ADR-0006。滞留したcoding_tasksを回収してよいかの判定（純粋関数）を検証する。
 *   個別runを特定できない制約下で、判断が常に安全側（回収しない側）へ倒れることを固定する。
 */
import { describe, expect, it } from "vitest";
import {
  classifyStaleRun,
  KNOWN_RUN_CONCLUSIONS,
  normalizeConclusion,
  RUN_LOOKBACK_MINUTES,
  runLookbackSince,
} from "../src/lib/codingTaskReap.js";

const complete = (runs: Array<{ id: number; status: string | null; conclusion: string | null }>) => ({
  runs,
  complete: true,
});

describe("classifyStaleRun [DevOps:REQ-028 / ADR-0006]", () => {
  it("完了していないrunが1件でもあれば回収しない [DevOps:REQ-028]", () => {
    expect(
      classifyStaleRun(
        complete([
          { id: 1, status: "completed", conclusion: "failure" },
          { id: 2, status: "in_progress", conclusion: null },
        ]),
      ),
    ).toEqual({ reap: false, reason: "still_executing" });
  });

  it("run皆無はdispatchが実体化しなかったとみなす [DevOps:REQ-028]", () => {
    expect(classifyStaleRun(complete([]))).toEqual({ reap: true, reason: "no_run_observed", conclusions: [] });
  });

  it("conclusion欠落はunknownとして記録する [DevOps:REQ-028]", () => {
    expect(classifyStaleRun(complete([{ id: 1, status: "completed", conclusion: null }]))).toEqual({
      reap: true,
      reason: "all_runs_completed",
      conclusions: ["unknown"],
    });
  });

  it("全件を見られていなければ、見えた範囲が全部完了でも回収しない [DevOps:REQ-028]", () => {
    // runは新しい順に返るため、打ち切った先に古い未完了のrunが隠れ得る。
    expect(
      classifyStaleRun({ runs: [{ id: 1, status: "completed", conclusion: "success" }], complete: false }),
    ).toEqual({ reap: false, reason: "observation_incomplete" });
  });

  it("全件未取得でも未完了が見えていれば still_executing を優先する [DevOps:REQ-028]", () => {
    expect(classifyStaleRun({ runs: [{ id: 1, status: "queued", conclusion: null }], complete: false })).toEqual({
      reap: false,
      reason: "still_executing",
    });
  });

  it("run皆無かつ全件未取得なら回収しない [DevOps:REQ-028]", () => {
    expect(classifyStaleRun({ runs: [], complete: false })).toEqual({
      reap: false,
      reason: "observation_incomplete",
    });
  });
});

describe("runLookbackSince [DevOps:REQ-028 / ADR-0006]", () => {
  it("時計ずれを見込んで下限を手前へ広げる [DevOps:REQ-028]", () => {
    expect(runLookbackSince("2026-08-04T01:00:00.000Z", 15)).toBe("2026-08-04T00:45:00.000Z");
  });

  it("既定のlookbackは正の値である [DevOps:REQ-028]", () => {
    expect(RUN_LOOKBACK_MINUTES).toBeGreaterThan(0);
    expect(Date.parse(runLookbackSince("2026-08-04T01:00:00.000Z"))).toBeLessThan(
      Date.parse("2026-08-04T01:00:00.000Z"),
    );
  });

  it("解釈できない時刻はそのまま返す（勝手にずらして観測窓を壊さない） [DevOps:REQ-028]", () => {
    expect(runLookbackSince("not-a-date")).toBe("not-a-date");
  });
});

describe("normalizeConclusion [DevOps:REQ-028]", () => {
  it("既知のconclusionはそのまま通す [DevOps:REQ-028]", () => {
    for (const known of KNOWN_RUN_CONCLUSIONS) expect(normalizeConclusion(known)).toBe(known);
  });

  it("未知の文字列はunknownへ写す（外部由来の値を追記専用ログへ通さない） [DevOps:REQ-028]", () => {
    expect(normalizeConclusion("ghp_0123456789abcdefghijklmnopqrstuvwxyzAB")).toBe("unknown");
    expect(normalizeConclusion("")).toBe("unknown");
    expect(normalizeConclusion(null)).toBe("unknown");
  });

  it("classifyStaleRunの結果も正規化済みになる [DevOps:REQ-028]", () => {
    const decision = classifyStaleRun({
      runs: [{ id: 1, status: "completed", conclusion: "token ghp_secretsecretsecretsecret" }],
      complete: true,
    });

    expect(decision).toEqual({ reap: true, reason: "all_runs_completed", conclusions: ["unknown"] });
  });
});
