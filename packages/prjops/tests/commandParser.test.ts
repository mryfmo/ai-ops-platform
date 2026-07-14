import { describe, it, expect } from "vitest";
import { parseCommand, checkCommandPermission } from "../src/lib/commandParser.js";

describe("parseCommand [SPEC-EXT-014]", () => {
  it("/action add を正しくパースする", () => {
    const r = parseCommand('/action add PJ-001 "設計レビュー資料の作成" @ST-020 期限:2026-07-10');
    expect(r.ok).toBe(true);
    expect(r.command).toEqual({
      kind: "action_add",
      projectId: "PJ-001",
      content: "設計レビュー資料の作成",
      assignee: "ST-020",
      due: "2026-07-10",
    });
  });

  it("/action done を正しくパースする", () => {
    const r = parseCommand("/action done ACT-0012");
    expect(r.command).toEqual({ kind: "action_done", actionId: "ACT-0012" });
  });

  it("/issue close を正しくパースする", () => {
    const r = parseCommand('/issue close ISSUE-0005 理由:"対応完了のため"');
    expect(r.command).toEqual({ kind: "issue_close", issueId: "ISSUE-0005", reason: "対応完了のため" });
  });

  it("/status override を正しくパースする", () => {
    const r = parseCommand('/status override PJ-003 Yellow 理由:"仕様変更のため計画見直し"');
    expect(r.command).toEqual({
      kind: "status_override",
      projectId: "PJ-003",
      color: "Yellow",
      reason: "仕様変更のため計画見直し",
    });
  });

  it("書式不正時は正しい書式例(usageHint)を返す", () => {
    const r = parseCommand("/action add PJ-001 内容が引用符なし");
    expect(r.ok).toBe(false);
    expect(r.usageHint).toContain("/action add");
  });

  it("status overrideで理由がない場合は不正としてusageHintを返す（理由必須）", () => {
    const r = parseCommand("/status override PJ-003 Yellow");
    expect(r.ok).toBe(false);
    expect(r.usageHint).toContain("理由");
  });

  it("どのコマンドにも該当しない自然文はok:false, usageHintなし（LLMフォールバック対象）", () => {
    const r = parseCommand("来週のレビューはどうなっていますか？");
    expect(r.ok).toBe(false);
    expect(r.usageHint).toBeUndefined();
  });
});

describe("parseCommand GitHub照会/コーディングタスク [ADR-0005 / ADR-0006]", () => {
  it("/gh pr list を正しくパースする", () => {
    const r = parseCommand("/gh pr list PJ-001");
    expect(r.ok).toBe(true);
    expect(r.command).toEqual({ kind: "gh_pr_list", projectId: "PJ-001" });
  });

  it("/gh issue list を正しくパースする", () => {
    const r = parseCommand("/gh issue list PJ-012");
    expect(r.command).toEqual({ kind: "gh_issue_list", projectId: "PJ-012" });
  });

  it("/gh issue create を正しくパースする", () => {
    const r = parseCommand('/gh issue create PJ-003 "ログイン画面の不具合" 本文:"再現手順は以下の通り"');
    expect(r.command).toEqual({
      kind: "gh_issue_create",
      projectId: "PJ-003",
      title: "ログイン画面の不具合",
      body: "再現手順は以下の通り",
    });
  });

  it("/code fix を正しくパースする", () => {
    const r = parseCommand('/code fix PJ-005 "nullチェック漏れを修正してテストを追加"');
    expect(r.command).toEqual({
      kind: "code_task",
      projectId: "PJ-005",
      instruction: "nullチェック漏れを修正してテストを追加",
    });
  });

  it("/gh issue create の本文欠落は不正としてusageHintを返す", () => {
    const r = parseCommand('/gh issue create PJ-003 "タイトルのみ"');
    expect(r.ok).toBe(false);
    expect(r.usageHint).toContain("本文");
  });

  it("/gh pr の書式不正はpr list書式のusageHintを返す", () => {
    const r = parseCommand("/gh pr list");
    expect(r.ok).toBe(false);
    expect(r.usageHint).toContain("/gh pr list");
  });

  it("/code の指示未指定は不正としてusageHintを返す", () => {
    const r = parseCommand("/code fix PJ-005");
    expect(r.ok).toBe(false);
    expect(r.usageHint).toContain("/code fix");
  });
});

describe("checkCommandPermission [PrjOps:SPEC-EXT-025 権限マトリクス]", () => {
  it("action_doneはPRF-01でも許可される", () => {
    expect(checkCommandPermission("action_done", "PRF-01").allowed).toBe(true);
  });
  it("status_overrideはPRF-01では拒否される", () => {
    const r = checkCommandPermission("status_override", "PRF-01");
    expect(r.allowed).toBe(false);
    expect(r.deniedMessage).toContain("権限が必要です");
  });
  it("status_overrideはPRF-02なら許可される", () => {
    expect(checkCommandPermission("status_override", "PRF-02").allowed).toBe(true);
  });
  it("issue_closeはPRF-04では拒否される", () => {
    expect(checkCommandPermission("issue_close", "PRF-04").allowed).toBe(false);
  });
  it("gh_pr_list / gh_issue_list はPRF-01でも許可される（ADR-0005 照会系）", () => {
    expect(checkCommandPermission("gh_pr_list", "PRF-01").allowed).toBe(true);
    expect(checkCommandPermission("gh_issue_list", "PRF-01").allowed).toBe(true);
  });
  it("gh_issue_create はPRF-01では拒否されPRF-02で許可される", () => {
    const denied = checkCommandPermission("gh_issue_create", "PRF-01");
    expect(denied.allowed).toBe(false);
    expect(denied.deniedMessage).toContain("PRF-02以上");
    expect(checkCommandPermission("gh_issue_create", "PRF-02").allowed).toBe(true);
  });
  it("code_task はPRF-01では拒否されPRF-03で許可される（ADR-0006）", () => {
    expect(checkCommandPermission("code_task", "PRF-01").allowed).toBe(false);
    expect(checkCommandPermission("code_task", "PRF-03").allowed).toBe(true);
  });
});
