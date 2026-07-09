/**
 * packages/server/src/lib/freeTextIntent.ts
 *
 * 根拠: SPEC-INT-033（定型コマンドの正規表現判定が不一致の場合のみLLMで意図解釈へフォールバック）/
 *   ADR-0005（Teamsチャネル自由文からのGitHub照会・操作意図の解釈）。
 *   packages/prjops/src/agents/AGT02_collector.ts の structureFreeText() と同一設計
 *   （AnthropicStructuredClient、tool_choice強制、温度0、sanitizeForLlmInput()適用）を踏襲する。
 *
 * 呼び出し条件: commandParser.parseCommand() が ok:false かつ usageHint が無い場合のみ
 *   （定型コマンド系統に一切一致しない自由文の場合。呼び出し判断はteamsConversationAgent側で行う）。
 */
import { z } from "zod";
import { sanitizeForLlmInput, type AnthropicStructuredClient } from "@aiops/shared";

export const FREE_TEXT_INTENT_TOOL_SCHEMA = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      enum: ["gh_pr_list", "gh_issue_list", "gh_issue_create", "code_task", "unknown"],
    },
    projectId: { type: ["string", "null"] },
    title: { type: ["string", "null"] },
    body: { type: ["string", "null"] },
    instruction: { type: ["string", "null"] },
  },
  required: ["intent", "projectId", "title", "body", "instruction"],
} as const;

const FreeTextIntentSchema = z.object({
  intent: z.enum(["gh_pr_list", "gh_issue_list", "gh_issue_create", "code_task", "unknown"]),
  projectId: z.string().nullable(),
  title: z.string().nullable(),
  body: z.string().nullable(),
  instruction: z.string().nullable(),
});

export type FreeTextIntent = z.infer<typeof FreeTextIntentSchema>;

const SYSTEM_PROMPT =
  "あなたはPrjOps/DevOps AI基盤のTeamsチャネル自由文解釈エンジンです。ユーザーの自由文メッセージから、" +
  "次のいずれかの意図を判定してください: " +
  "gh_pr_list（PR一覧照会）, gh_issue_list（Issue一覧照会）, gh_issue_create（Issue起票）, " +
  "code_task（コーディングタスク指示）, unknown（上記のいずれにも該当しない、または情報不足）。" +
  "projectId は本文中のPJ-nnn形式のIDを抽出してください（見つからなければnull）。" +
  "gh_issue_create の場合はtitleとbodyを、code_task の場合はinstructionを抽出してください。" +
  "該当しない項目はnullとしてください。判定に自信が持てない場合は必ずunknownとしてください。";

/** SPEC-INT-033: 定型コマンド不一致の自由文に対するLLM意図解釈を1回実行する */
export async function interpretFreeTextIntent(
  llmClient: AnthropicStructuredClient,
  text: string,
): Promise<FreeTextIntent> {
  const sanitized = sanitizeForLlmInput(text).sanitized;
  const result = await llmClient.call<FreeTextIntent>({
    agent: "SERVER",
    purpose: "teams_free_text_intent",
    system: SYSTEM_PROMPT,
    user: sanitized,
    toolName: "emit_free_text_intent",
    toolDescription: "自由文メッセージから解釈した意図と関連パラメータを返す",
    inputSchema: FREE_TEXT_INTENT_TOOL_SCHEMA,
    parse: (raw) => FreeTextIntentSchema.parse(raw),
    maxAttempts: 2,
    allowEscalation: false,
  });
  return result.value;
}
