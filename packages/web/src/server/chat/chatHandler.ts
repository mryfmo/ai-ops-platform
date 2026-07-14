/**
 * packages/web/src/server/chat/chatHandler.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード：チャットによる動的表示切替）/
 *   ADR-0013 / REQ-041 / SPEC-INT-068 / AC-041-1。POST /api/chat のハンドラ本体。
 *
 * 認可: dataApiSupport.resolvePersonas（requireSession+requirePersona経由）で未認証401・
 *   権限外403を処理する（既存 /api/data/* ハンドラと同じ方式）。
 * コストガード: PgCostGuard.reserve() で呼び出し前に見積コストを予約し、日次上限超過を429で返す
 *   （SPEC-INT-060。agent="WEB-CHAT"としてサブ上限を区別できるようにする）。
 *   security-reviewer指摘(高): 従来assertWithinBudgetの事前チェックのみで、応答後の
 *   costGuard.record()が一度も呼ばれておらず、llm_usageに実消費が記録されないため日次上限が
 *   実質機能していなかった。streamTextのonFinishでusageを受け取り記録するよう修正した
 *   T26ではreserve/reconcile方式にして、ストリーム途中エラーでも予約行が残るようにする。
 * 未設定時503: ANTHROPIC_API_KEY が無い場合はモデル呼び出し自体を行わず503を返す
 *   （呼び出し側route.tsがconfig.ANTHROPIC_API_KEYの有無を渡す）。
 *
 * DIを引数で受け取る設計（getSession/resolver/languageModel/costGuard）にすることで、
 * route.ts（本番配線）と切り離してネットワーク・実DBなしでテストできる
 * （ai/test の MockLanguageModelV2 を languageModel として注入する）。
 *
 * ペルソナ選択方針: dashboard/page.tsx・data API と同じ選択値を、現在の保有ペルソナに
 * 含まれるか検証してから採用する。未選択時は従来どおり先頭を採用する。
 */
import type { Session } from "next-auth";
import { streamText, stepCountIs, convertToModelMessages, type LanguageModel, type UIMessage } from "ai";
import {
  estimateCostUsd,
  resolveModelPrice,
  sanitizeForLlmInput,
  type AuditLogWriter,
  type ModelPricingUsdPerMtok,
  type PgCostGuard,
} from "@aiops/shared";
import type { PersonaResolver, ResolvedPersona } from "../personaResolver";
import { resolvePersonas, toErrorResponse } from "../reportData/dataApiSupport";
import { safeParseViewSpec } from "../viewSpec";
import { buildToolsForPersona } from "./tools";
import { buildSystemPrompt, type PageAgentContext } from "./systemPrompt";

/** /api/chat が使用するコスト台帳のagent識別子（SPEC-INT-060のagent別サブ上限区分用） */
export const CHAT_COST_AGENT = "WEB-CHAT";
const DEFAULT_PAGE_AGENT_MAX_STEPS = 5;
const DEFAULT_THINKING_BUDGET_TOKENS = 12000;
const DEFAULT_CHAT_ESTIMATED_OUTPUT_TOKENS = 4096;

export interface ChatHandlerDeps {
  getSession: () => Promise<Session | null>;
  resolver: PersonaResolver;
  /** ANTHROPIC_API_KEY 未設定時は undefined を渡す（route.ts側の責務） */
  languageModel: LanguageModel | undefined;
  costGuard: PgCostGuard;
  auditLog?: AuditLogWriter;
  auditLogForDomain?: (domain: ResolvedPersona["domain"]) => AuditLogWriter;
  traceIdProvider?: () => string;
  pricingUsdPerMtok: ModelPricingUsdPerMtok;
  messages: UIMessage[];
  pageContext?: unknown;
  maxSteps?: number;
  thinkingBudgetTokens?: number;
  /** costGuard.record()のコスト見積もりに使うモデル名（route.tsのCHAT_MODELと一致させる） */
  modelName: string;
  selectedPersona?: string;
  maxRetries?: number;
}

function sanitizeText(value: unknown): string | undefined {
  return typeof value === "string" ? sanitizeForLlmInput(value).sanitized : undefined;
}

function sanitizePageContext(raw: unknown): PageAgentContext | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const input = raw as Record<string, unknown>;
  return {
    period: sanitizeText(input["period"]),
    baseDate: sanitizeText(input["baseDate"]),
    projectId: sanitizeText(input["projectId"]),
    currentView: safeParseViewSpec(input["view"]).data,
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

export class ChatRefusalError extends Error {
  constructor() {
    super("E-LLM-REFUSAL: model refused the chat request");
    this.name = "ChatRefusalError";
  }
}

function estimatedMessageTokens(system: string, messages: UIMessage[]): number {
  return Math.ceil((system.length + JSON.stringify(messages).length) / 4) + 512;
}

export function isRefusalFinishReason(finishReason: unknown): boolean {
  return finishReason === "refusal" || finishReason === "content-filter";
}

export async function handleChat(deps: ChatHandlerDeps): Promise<Response> {
  try {
    const [persona] = await resolvePersonas(deps.getSession, deps.resolver, undefined, deps.selectedPersona);

    if (!deps.languageModel) {
      return Response.json({ error: "チャット機能は現在利用できません" }, { status: 503 });
    }

    const tools = buildToolsForPersona(persona!);
    const system = buildSystemPrompt(persona!, sanitizePageContext(deps.pageContext));

    const modelName = deps.modelName;
    const pricing = deps.pricingUsdPerMtok;
    if (deps.auditLog && deps.auditLogForDomain) {
      throw new Error("E-CFG04: configure auditLog or auditLogForDomain, not both");
    }
    const auditLog = deps.auditLogForDomain?.(persona!.domain) ?? deps.auditLog;
    if (Boolean(auditLog) !== Boolean(deps.traceIdProvider)) {
      throw new Error("E-CFG04: auditLog and traceIdProvider must be configured together");
    }
    const sanitizedMessages = sanitizeMessages(deps.messages);
    const at = new Date().toISOString();
    const { price, usedFallback } = resolveModelPrice(modelName, pricing);
    if (usedFallback && !auditLog) {
      throw new Error("E-CFG04: auditLog is required for unknown model pricing fallback");
    }
    if (usedFallback) {
      const traceId = deps.traceIdProvider?.();
      if (!traceId) throw new Error("E-CFG04: traceIdProvider is required when pricing audit is enabled");
      await auditLog!.append({
        trace_id: traceId,
        actor: CHAT_COST_AGENT,
        action: "llm_unknown_model_pricing_fallback",
        basis: "SPEC-INT-060",
        detail: { severity: "warn", model: modelName, applied_price_usd_per_mtok: price },
        at,
      });
    }
    const reservedUsage = {
      at,
      agent: CHAT_COST_AGENT,
      purpose: "view_switching",
      model: modelName,
      input_tokens: estimatedMessageTokens(system, sanitizedMessages),
      output_tokens: DEFAULT_CHAT_ESTIMATED_OUTPUT_TOKENS,
      estimated_cost_usd: estimateCostUsd(
        modelName,
        estimatedMessageTokens(system, sanitizedMessages),
        DEFAULT_CHAT_ESTIMATED_OUTPUT_TOKENS,
        pricing,
      ),
    };
    let reservationId: string;
    try {
      reservationId = await deps.costGuard.reserve(reservedUsage);
    } catch {
      return Response.json(
        { error: "E-COST01: 本日のLLM利用上限に達したため、チャットは一時的に利用できません" },
        { status: 429 },
      );
    }

    const result = streamText({
      model: deps.languageModel,
      system,
      messages: convertToModelMessages(sanitizedMessages),
      tools,
      stopWhen: stepCountIs(deps.maxSteps ?? DEFAULT_PAGE_AGENT_MAX_STEPS),
      maxRetries: deps.maxRetries ?? 2,
      providerOptions: {
        anthropic: {
          thinking: {
            type: "enabled",
            budgetTokens: deps.thinkingBudgetTokens ?? DEFAULT_THINKING_BUDGET_TOKENS,
          },
        },
      },
      prepareStep: async () => ({ toolChoice: "auto" }),
      onFinish: async ({ finishReason, totalUsage }) => {
        const isRefusal = isRefusalFinishReason(finishReason);
        if (finishReason === "error" && !isRefusal) return;
        const inputTokens = totalUsage?.inputTokens ?? 0;
        const outputTokens = totalUsage?.outputTokens ?? 0;
        await deps.costGuard.reconcileReservation(reservationId, {
          at: new Date().toISOString(),
          agent: CHAT_COST_AGENT,
          purpose: "view_switching",
          model: modelName,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          estimated_cost_usd: estimateCostUsd(modelName, inputTokens, outputTokens, pricing),
        });
        if (isRefusal) {
          throw new ChatRefusalError();
        }
      },
    });

    return result.toUIMessageStreamResponse({ sendReasoning: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
