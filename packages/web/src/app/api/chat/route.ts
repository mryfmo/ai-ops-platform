/**
 * packages/web/src/app/api/chat/route.ts
 *
 * 根拠: P010-F02-T08 / ADR-0005（WebUIダッシュボード：チャットによる動的表示切替）/
 *   ADR-0013 / PrjOps:REQ-041 / DevOps:REQ-041 / PrjOps:SPEC-INT-068 / DevOps:SPEC-INT-068 / PrjOps:AC-041-1 / DevOps:AC-041-1。POST /api/chat —
 * 本ファイルは本番用DI（auth() + pg.Pool + LiteLLM gateway provider + PgCostGuard）を組み立てて
 * server/chat/chatHandler.ts へ委譲する薄い配線層。
 *
 * gateway flag が off の場合は languageModel を undefined のままハンドラへ渡し、
 * ハンドラ側が503を返す（ビルド時にvirtual keyを要求しない）。direct provider は構成しない。
 */
import type { UIMessage } from "ai";
import { PgAuditLog, PgCostGuard } from "@aiops/shared";
import { randomUUID } from "node:crypto";
import { auth } from "../../../auth";
import { loadWebConfig } from "../../../server/config";
import { getPool } from "../../../server/db/pool";
import { CompositePersonaResolver, DevopsPersonaSource, PrjopsPersonaSource } from "../../../server/personaResolver";
import { handleChat } from "../../../server/chat/chatHandler";
import { selectedPersonaFromRequest } from "../../../server/authGuard";
import { createPinnedPrjopsReportDataProvider } from "../../../server/reportData/pinnedPrjopsReportDataProvider";
import { toErrorResponse } from "../../../server/reportData/dataApiSupport";
import { createWebChatModel } from "../../../server/chat/provider";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const config = loadWebConfig();
  const pool = getPool(config.DATABASE_URL);
  let provider;
  try {
    provider = createPinnedPrjopsReportDataProvider(config);
  } catch (error) {
    return toErrorResponse(error);
  }
  const resolver = new CompositePersonaResolver(new DevopsPersonaSource(pool), new PrjopsPersonaSource(provider));

  const chatModel = config.ANTHROPIC_DEFAULT_MODEL;
  const languageModel = config.LLM_GATEWAY_ENABLED ? createWebChatModel(config) : undefined;

  const costGuard = new PgCostGuard(pool, {
    perAgentDailyLimitUsd: { "WEB-CHAT": 10 },
    perAgentRequestLimitUsd: { "WEB-CHAT": 1 },
  });

  const body = (await request.json()) as { messages: UIMessage[]; pageContext?: unknown };

  return handleChat({
    getSession: async () => auth(),
    resolver,
    languageModel,
    costGuard,
    auditLogForDomain: (domain) => new PgAuditLog(pool, domain === "devops" ? "devops_1y" : "prjops_5y"),
    traceIdProvider: () => randomUUID(),
    pricingUsdPerMtok: config.ANTHROPIC_PRICING_USD_PER_MTOK,
    messages: body.messages,
    pageContext: body.pageContext,
    maxSteps: config.PAGE_AGENT_MAX_STEPS,
    thinkingBudgetTokens: config.PAGE_AGENT_THINKING_BUDGET_TOKENS,
    modelName: chatModel,
    selectedPersona: selectedPersonaFromRequest(request),
    maxRetries: 2,
  });
}
