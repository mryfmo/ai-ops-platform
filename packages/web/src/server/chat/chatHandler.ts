/**
 * packages/web/src/server/chat/chatHandler.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード：チャットによる動的表示切替）/
 *   ADR-0013 / REQ-041 / SPEC-INT-068 / AC-041-1。POST /api/chat のハンドラ本体。
 *
 * 認可: dataApiSupport.resolvePersonas（requireSession+requirePersona経由）で未認証401・
 *   権限外403を処理する（既存 /api/data/* ハンドラと同じ方式）。
 * コストガード: PgCostGuard.assertWithinBudget() で日次上限超過を検知し429を返す
 *   （SPEC-INT-060。agent="WEB-CHAT"としてサブ上限を区別できるようにする）。
 *   security-reviewer指摘(高): 従来assertWithinBudgetの事前チェックのみで、応答後の
 *   costGuard.record()が一度も呼ばれておらず、llm_usageに実消費が記録されないため日次上限が
 *   実質機能していなかった。streamTextのonFinishでusageを受け取り記録するよう修正した
 *   （既存AnthropicStructuredClient.callと同じestimateCostUsdを再利用）。
 * 未設定時503: ANTHROPIC_API_KEY が無い場合はモデル呼び出し自体を行わず503を返す
 *   （呼び出し側route.tsがconfig.ANTHROPIC_API_KEYの有無を渡す）。
 *
 * DIを引数で受け取る設計（getSession/resolver/languageModel/costGuard）にすることで、
 * route.ts（本番配線）と切り離してネットワーク・実DBなしでテストできる
 * （ai/test の MockLanguageModelV2 を languageModel として注入する）。
 *
 * ペルソナ選択方針: dashboard/page.tsx・managerSummaryHandler.ts と同じく、複数ペルソナを
 * 持つアカウントは先頭のペルソナのみを採用する（複数ペルソナ切替UIは#14の残課題）。
 */
import type { Session } from "next-auth";
import { streamText, stepCountIs, convertToModelMessages, type LanguageModel, type UIMessage } from "ai";
import { estimateCostUsd, DEFAULT_MODEL, sanitizeForLlmInput, type PgCostGuard } from "@aiops/shared";
import type { PersonaResolver } from "../personaResolver";
import { resolvePersonas, toErrorResponse } from "../reportData/dataApiSupport";
import { buildToolsForPersona } from "./tools";
import { buildSystemPrompt, type PageAgentContext } from "./systemPrompt";

/** /api/chat が使用するコスト台帳のagent識別子（SPEC-INT-060のagent別サブ上限区分用） */
export const CHAT_COST_AGENT = "WEB-CHAT";
const DEFAULT_PAGE_AGENT_MAX_STEPS = 5;
const DEFAULT_THINKING_BUDGET_TOKENS = 12000;

export interface ChatHandlerDeps {
  getSession: () => Promise<Session | null>;
  resolver: PersonaResolver;
  /** ANTHROPIC_API_KEY 未設定時は undefined を渡す（route.ts側の責務） */
  languageModel: LanguageModel | undefined;
  costGuard: PgCostGuard;
  messages: UIMessage[];
  pageContext?: unknown;
  maxSteps?: number;
  thinkingBudgetTokens?: number;
  /** costGuard.record()のコスト見積もりに使うモデル名（route.tsのCHAT_MODELと一致させる） */
  modelName?: string;
}

function sanitizeText(value: unknown): string | undefined {
  return typeof value === "string" ? sanitizeForLlmInput(value).sanitized : undefined;
}

function sanitizeViewSpec(raw: unknown): PageAgentContext["currentView"] {
  if (!raw || typeof raw !== "object") return undefined;
  const input = raw as Record<string, unknown>;
  const kind = sanitizeText(input["kind"]);
  if (kind === "managerSummary") {
    const periodDays = input["periodDays"];
    return periodDays === 7 || periodDays === 14 || periodDays === 28 ? { kind, periodDays } : { kind };
  }
  if (kind === "timeseries") {
    const period = sanitizeText(input["period"]);
    return period === "week" || period === "month" || period === "quarter" || period === "half" || period === "year"
      ? { kind, period }
      : { kind };
  }
  if (kind === "executiveSummary" || kind === "investorSummary" || kind === "projectList" || kind === "agentActivity") {
    return { kind };
  }
  return undefined;
}

function sanitizePageContext(raw: unknown): PageAgentContext | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const input = raw as Record<string, unknown>;
  return {
    period: sanitizeText(input["period"]),
    baseDate: sanitizeText(input["baseDate"]),
    projectId: sanitizeText(input["projectId"]),
    currentView: sanitizeViewSpec(input["view"]),
  };
}

function sanitizeMessages(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => ({
    ...message,
    parts: message.parts.map((part) =>
      part.type === "text" ? { ...part, text: sanitizeForLlmInput(part.text).sanitized } : part,
    ),
  }));
}

export async function handleChat(deps: ChatHandlerDeps): Promise<Response> {
  try {
    const personas = await resolvePersonas(deps.getSession, deps.resolver);
    const persona = personas[0]!;

    if (!deps.languageModel) {
      return Response.json({ error: "チャット機能は現在利用できません" }, { status: 503 });
    }

    try {
      await deps.costGuard.assertWithinBudget(CHAT_COST_AGENT);
    } catch {
      return Response.json(
        { error: "E-COST01: 本日のLLM利用上限に達したため、チャットは一時的に利用できません" },
        { status: 429 },
      );
    }

    const tools = buildToolsForPersona(persona);
    const system = buildSystemPrompt(persona, sanitizePageContext(deps.pageContext));

    const modelName = deps.modelName ?? DEFAULT_MODEL;
    const result = streamText({
      model: deps.languageModel,
      system,
      messages: convertToModelMessages(sanitizeMessages(deps.messages)),
      tools,
      temperature: 0,
      stopWhen: stepCountIs(deps.maxSteps ?? DEFAULT_PAGE_AGENT_MAX_STEPS),
      providerOptions: {
        anthropic: {
          thinking: {
            type: "enabled",
            budgetTokens: deps.thinkingBudgetTokens ?? DEFAULT_THINKING_BUDGET_TOKENS,
          },
        },
      },
      prepareStep: async () => ({ toolChoice: "auto" }),
      onFinish: async ({ usage }) => {
        // security-reviewer指摘(高)対応: 応答完了時に必ずllm_usageへ記録し、
        // assertWithinBudgetの日次上限チェックを実効化する。
        const inputTokens = usage?.inputTokens ?? 0;
        const outputTokens = usage?.outputTokens ?? 0;
        await deps.costGuard.record({
          at: new Date().toISOString(),
          agent: CHAT_COST_AGENT,
          purpose: "view_switching",
          model: modelName,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          estimated_cost_usd: estimateCostUsd(modelName, inputTokens, outputTokens),
        });
      },
    });

    return result.toUIMessageStreamResponse({ sendReasoning: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
