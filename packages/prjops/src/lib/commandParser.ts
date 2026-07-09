/**
 * packages/prjops/src/lib/commandParser.ts
 *
 * 根拠: SPEC-EXT-014 Teamsコマンド / SPEC-INT-033 コマンドパーサ
 *   本システム宛のTeamsメッセージで次の定型コマンドを受け付ける（PRF-02以上）:
 *     /action add PJ-nnn "{内容}" @担当者 期限:YYYY-MM-DD  — アクション登録
 *     /action done ACT-nnn                                 — アクション完了
 *     /issue close ISSUE-nnn 理由:"{...}"                  — 課題クローズ（PRF-02のみ）
 *     /status override PJ-nnn {Green|Yellow|Red} 理由:"{...}" — 機械判定の上書き（PRF-02のみ、理由必須）
 *   コマンド不正時は正しい書式例を返す。
 *   SPEC-INT-033: 正規表現で定型コマンドを先に判定し、不一致の場合のみLLMで意図解釈→確認カード。
 *   権限チェックは実行直前にstakeholderマスタで行う。
 *
 * 追加根拠（ADR-0005 / ADR-0006）: Teamsチャネルからの GitHub照会・操作コマンドと
 *   AIコーディングタスク指示コマンドを同一のパーサ・権限マトリクス方式で受け付ける:
 *     /gh pr list PJ-nnn                              — PR一覧照会（PRF-01以上）
 *     /gh issue list PJ-nnn                           — Issue一覧照会（PRF-01以上）
 *     /gh issue create PJ-nnn "タイトル" 本文:"{...}"  — Issue起票（PRF-02以上）
 *     /code fix PJ-nnn "{指示内容}"                    — コーディングタスク指示（PRF-02以上。ADR-0006）
 */

export type ParsedCommand =
  | { kind: "action_add"; projectId: string; content: string; assignee: string; due: string }
  | { kind: "action_done"; actionId: string }
  | { kind: "issue_close"; issueId: string; reason: string }
  | { kind: "status_override"; projectId: string; color: "Green" | "Yellow" | "Red"; reason: string }
  | { kind: "gh_pr_list"; projectId: string }
  | { kind: "gh_issue_list"; projectId: string }
  | { kind: "gh_issue_create"; projectId: string; title: string; body: string }
  | { kind: "code_task"; projectId: string; instruction: string };

export interface ParseResult {
  ok: boolean;
  command?: ParsedCommand;
  usageHint?: string; // コマンド不正時に返す正しい書式例
}

const USAGE_HINTS = {
  action_add: '/action add PJ-nnn "{内容}" @担当者 期限:YYYY-MM-DD',
  action_done: "/action done ACT-nnn",
  issue_close: '/issue close ISSUE-nnn 理由:"{...}"',
  status_override: '/status override PJ-nnn {Green|Yellow|Red} 理由:"{...}"',
  gh_pr_list: "/gh pr list PJ-nnn",
  gh_issue_list: "/gh issue list PJ-nnn",
  gh_issue_create: '/gh issue create PJ-nnn "{タイトル}" 本文:"{...}"',
  code_task: '/code fix PJ-nnn "{指示内容}"',
} as const;

const RE_ACTION_ADD = /^\/action\s+add\s+(PJ-\d{3,})\s+"([^"]+)"\s+@(\S+)\s+期限:(\d{4}-\d{2}-\d{2})\s*$/;
const RE_ACTION_DONE = /^\/action\s+done\s+(ACT-\d{3,})\s*$/;
const RE_ISSUE_CLOSE = /^\/issue\s+close\s+(ISSUE-\d{3,})\s+理由:"([^"]+)"\s*$/;
const RE_STATUS_OVERRIDE = /^\/status\s+override\s+(PJ-\d{3,})\s+(Green|Yellow|Red)\s+理由:"([^"]+)"\s*$/;
const RE_GH_PR_LIST = /^\/gh\s+pr\s+list\s+(PJ-\d{3,})\s*$/;
const RE_GH_ISSUE_LIST = /^\/gh\s+issue\s+list\s+(PJ-\d{3,})\s*$/;
const RE_GH_ISSUE_CREATE = /^\/gh\s+issue\s+create\s+(PJ-\d{3,})\s+"([^"]+)"\s+本文:"([^"]+)"\s*$/;
const RE_CODE_TASK = /^\/code\s+fix\s+(PJ-\d{3,})\s+"([^"]+)"\s*$/;

/**
 * 定型コマンドの正規表現マッチのみを行う（SPEC-INT-033手順1）。
 * 一致しない場合は ok:false + どのコマンド系統に近いかのusageHintを返す。
 * どの系統にも該当しない自然文は呼び出し側でLLM意図解釈へフォールバックする。
 */
export function parseCommand(text: string): ParseResult {
  const trimmed = text.trim();

  const mAdd = trimmed.match(RE_ACTION_ADD);
  if (mAdd) {
    return {
      ok: true,
      command: { kind: "action_add", projectId: mAdd[1]!, content: mAdd[2]!, assignee: mAdd[3]!, due: mAdd[4]! },
    };
  }
  const mDone = trimmed.match(RE_ACTION_DONE);
  if (mDone) {
    return { ok: true, command: { kind: "action_done", actionId: mDone[1]! } };
  }
  const mClose = trimmed.match(RE_ISSUE_CLOSE);
  if (mClose) {
    return { ok: true, command: { kind: "issue_close", issueId: mClose[1]!, reason: mClose[2]! } };
  }
  const mOverride = trimmed.match(RE_STATUS_OVERRIDE);
  if (mOverride) {
    return {
      ok: true,
      command: {
        kind: "status_override",
        projectId: mOverride[1]!,
        color: mOverride[2] as "Green" | "Yellow" | "Red",
        reason: mOverride[3]!,
      },
    };
  }

  const mGhPrList = trimmed.match(RE_GH_PR_LIST);
  if (mGhPrList) {
    return { ok: true, command: { kind: "gh_pr_list", projectId: mGhPrList[1]! } };
  }
  const mGhIssueCreate = trimmed.match(RE_GH_ISSUE_CREATE);
  if (mGhIssueCreate) {
    return {
      ok: true,
      command: {
        kind: "gh_issue_create",
        projectId: mGhIssueCreate[1]!,
        title: mGhIssueCreate[2]!,
        body: mGhIssueCreate[3]!,
      },
    };
  }
  const mGhIssueList = trimmed.match(RE_GH_ISSUE_LIST);
  if (mGhIssueList) {
    return { ok: true, command: { kind: "gh_issue_list", projectId: mGhIssueList[1]! } };
  }
  const mCodeTask = trimmed.match(RE_CODE_TASK);
  if (mCodeTask) {
    return { ok: true, command: { kind: "code_task", projectId: mCodeTask[1]!, instruction: mCodeTask[2]! } };
  }

  // どのコマンド系統を意図しているか大まかに推定してusageHintを返す（不正書式時の親切なエラー）
  if (/^\/action\s+add/.test(trimmed)) return { ok: false, usageHint: USAGE_HINTS.action_add };
  if (/^\/action\s+done/.test(trimmed)) return { ok: false, usageHint: USAGE_HINTS.action_done };
  if (/^\/issue\s+close/.test(trimmed)) return { ok: false, usageHint: USAGE_HINTS.issue_close };
  if (/^\/status\s+override/.test(trimmed)) return { ok: false, usageHint: USAGE_HINTS.status_override };
  if (/^\/gh\s+pr/.test(trimmed)) return { ok: false, usageHint: USAGE_HINTS.gh_pr_list };
  if (/^\/gh\s+issue\s+create/.test(trimmed)) return { ok: false, usageHint: USAGE_HINTS.gh_issue_create };
  if (/^\/gh\s+issue/.test(trimmed)) return { ok: false, usageHint: USAGE_HINTS.gh_issue_list };
  if (/^\/code/.test(trimmed)) return { ok: false, usageHint: USAGE_HINTS.code_task };

  return { ok: false }; // どのコマンドにも該当しない → 呼び出し側でLLM意図解釈にフォールバック
}

// spec-reviewer指摘: PRF-04（経営陣）/PRF-05（投資元）はいずれのTeamsコマンドに対しても
// 常に拒否される（許可リストに一度も現れない）。これは意図的な設計であり、両プロファイルは
// レポート閲覧専用のペルソナでTeamsコマンド実行の対象外とするため（型がPRF-01〜03に限定されている理由）。
const PROFILE_REQUIREMENTS: Record<ParsedCommand["kind"], ReadonlyArray<"PRF-01" | "PRF-02" | "PRF-03">> = {
  action_add: ["PRF-02", "PRF-03"],
  action_done: ["PRF-01", "PRF-02", "PRF-03"], // 完了のみは本人担当分についてPRF-01も可（SPEC-EXT-025の権限マトリクス）
  issue_close: ["PRF-02", "PRF-03"],
  status_override: ["PRF-02", "PRF-03"],
  gh_pr_list: ["PRF-01", "PRF-02", "PRF-03"], // 照会系はPRF-01も可（ADR-0005）
  gh_issue_list: ["PRF-01", "PRF-02", "PRF-03"],
  gh_issue_create: ["PRF-02", "PRF-03"], // 書込系はPRF-02以上（ADR-0005）
  code_task: ["PRF-02", "PRF-03"], // コーディングタスク指示はPRF-02以上（ADR-0006）
};

export interface PermissionCheckResult {
  allowed: boolean;
  deniedMessage?: string;
}

/** SPEC-EXT-025 権限マトリクスに基づく実行直前チェック */
export function checkCommandPermission(
  kind: ParsedCommand["kind"],
  callerProfile: "PRF-01" | "PRF-02" | "PRF-03" | "PRF-04" | "PRF-05",
): PermissionCheckResult {
  const allowedProfiles = PROFILE_REQUIREMENTS[kind];
  if ((allowedProfiles as readonly string[]).includes(callerProfile)) {
    return { allowed: true };
  }
  const prf01Allowed: ReadonlyArray<ParsedCommand["kind"]> = ["action_done", "gh_pr_list", "gh_issue_list"];
  const requiredLabel = prf01Allowed.includes(kind) ? "PRF-01以上" : "PRF-02以上";
  return { allowed: false, deniedMessage: `この操作には${requiredLabel}権限が必要です` };
}
