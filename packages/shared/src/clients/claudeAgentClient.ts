/**
 * packages/shared/src/clients/claudeAgentClient.ts
 *
 * 根拠:
 *   - DevOps SPEC-INT-011 手順4: 「classificationがtest_failureまたはcompile_errorの場合のみ
 *     Claude Codeを起動し、対象リポジトリのread-onlyチェックアウト上で修正diffを生成
 *     （書き込み権限を与えない。AC-002b）」
 *   - DevOps SPEC-INT-063: 「コード修正案はClaude Code（read-onlyワークスペース）」「プロンプトは
 *     /prompts でバージョン管理し、変更は通常のPRレビューを経る」
 *   - REQ-002 AC-002b: 修正案がリポジトリへ自動コミット・自動マージされないことをテストで確認。
 *
 * パッケージ: @anthropic-ai/claude-agent-sdk（旧称 Claude Code SDK。2025年後半に改称。
 *   pnpm add @anthropic-ai/claude-agent-sdk / 認証はANTHROPIC_API_KEY環境変数）。
 *   出典: https://docs.claude.com/en/docs/agent-sdk/typescript
 *
 * 設計方針（書き込み禁止の多層防御）:
 *   (1) tools でモデルへ公開するツールを読み取り専用のみに限定し、allowedTools でその3種を
 *       自動許可する。Write/Edit/Bash等は disallowedTools でも明示的に禁止する。
 *   (2) canUseTool フックでは読み取り専用allowlist以外をすべて拒否し、将来追加されるツールも
 *       fail-closedにする（tools設定漏れに対する保険）。
 *   (3) 生成された差分はこのプロセス内の文字列としてのみ受け取り、対象リポジトリへの書き込みAPI
 *       （git commit/push, GitHub Contents API等）を本モジュールが一切呼び出さないことでAC-002bを満たす。
 *
 * 注: Agent SDKのオプション名（allowedTools/disallowedTools/canUseTool等）はSDKのバージョンにより
 *     変わり得るため、導入時は https://docs.claude.com/en/docs/agent-sdk/typescript の最新リファレンス
 *     で名称を再確認すること（本ファイル冒頭にその旨をコメントで明記する）。
 */
import { query, type Options as AgentSdkOptions } from "@anthropic-ai/claude-agent-sdk";

const READ_ONLY_TOOLS = ["Read", "Grep", "Glob"] as const;
const MUTATING_TOOLS = ["Write", "Edit", "Bash", "NotebookEdit"] as const;

export interface DiffSuggestionRequest {
  repoCheckoutPath: string; // read-onlyでチェックアウト済みのローカルパス
  failedJob: string;
  failedStep: string;
  logExcerpt: string; // 既にsecretSanitizerでサニタイズ済みであること
  classification: "test_failure" | "compile_error";
  promptVersion: string; // /prompts/PROMPT-BLD-01.md のバージョン識別子
}

export interface DiffSuggestionResult {
  diffText: string | null; // 生成できなかった場合はnull（AC-002a: 8件中8件以上を目標。全件成功は保証しない）
  rawTranscriptSummary: string;
}

/**
 * read-onlyワークスペース上でClaude Codeを起動し、修正diffを生成する。
 * 本関数は一切のファイル書き込み・コマンド実行を許可しない設定でqueryを呼ぶ。
 */
export async function generateReadOnlyDiffSuggestion(req: DiffSuggestionRequest): Promise<DiffSuggestionResult> {
  const prompt = [
    `失敗ジョブ: ${req.failedJob} / ステップ: ${req.failedStep}`,
    `分類: ${req.classification}`,
    `ログ抜粋:\n${req.logExcerpt}`,
    "",
    "上記の失敗を解消する修正案を unified diff 形式のみで出力してください。",
    "リポジトリへの書き込み・コミットは行わないでください（read-onlyモードで実行されています）。",
    "diff以外の説明文は最小限にしてください。",
  ].join("\n");

  const options: AgentSdkOptions = {
    cwd: req.repoCheckoutPath,
    model: "sonnet",
    // (1) モデルに公開するツール自体をread-onlyに限定
    tools: [...READ_ONLY_TOOLS],
    // read-onlyツールだけをプロンプトなしで許可
    allowedTools: [...READ_ONLY_TOOLS],
    disallowedTools: [...MUTATING_TOOLS],
    permissionMode: "default",
    // (2) 実行時フックでもread-only以外をすべて拒否（将来追加されるツールもfail-closed）
    canUseTool: async (toolName: string) => {
      if ((READ_ONLY_TOOLS as readonly string[]).includes(toolName)) {
        return { behavior: "allow" };
      }
      return { behavior: "deny", message: "read-only workspace: tool is not allowlisted (SPEC-INT-011)" };
    },
    settingSources: [], // SDKアプリケーションとしての分離設定を明示（プロジェクト側の設定を継承しない）
  };

  let diffText: string | null = null;
  const transcriptParts: string[] = [];

  for await (const message of query({ prompt, options })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") {
          transcriptParts.push(block.text);
          const match = block.text.match(/```(?:diff)?\n([\s\S]*?)```/);
          if (match) diffText = match[1] ?? null;
        }
      }
    }
    if (message.type === "result" && message.subtype === "success" && !diffText) {
      // diffがコードブロック無しで返った場合のフォールバック
      const text = (message as { result?: string }).result;
      if (text && text.includes("---") && text.includes("+++")) {
        diffText = text;
      }
    }
  }

  return {
    diffText,
    rawTranscriptSummary: transcriptParts.join("\n").slice(0, 4000),
  };
}
