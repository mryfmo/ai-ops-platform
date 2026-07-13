/**
 * packages/web/src/server/reportData/agentActivityHandler.ts
 *
 * 根拠: ADR-0006（AIコーディングエージェント統合）決定4b。GET /api/data/agent-activity の
 *   ハンドラ本体。PRF-G（DevOpsマネージャー）専用。coding_tasksのステータス別件数・
 *   完了成功率・直近生成PR一覧を返す。
 *
 * 認可: requireSession（未認証401）→ requirePersona(domain="devops")（該当ペルソナなし403）を
 *   必ず経由する。取得したペルソナにPRF-Gが含まれない場合も403（このAPIはPRF-G専用。
 *   PRF-L公開は次フェーズの残課題。CLAUDE.md記載のとおり現状Web側にPRF-L向けの
 *   AgentActivityView配線が無いため）。
 *
 * DIを引数で受け取る設計（getSession/resolver/db）にすることで、route.ts（本番配線）と
 * 切り離してネットワーク・実DBなしでテストできる（executiveSummaryHandler.tsと同じ設計パターン）。
 */
import type { Session } from "next-auth";
import type { PgQueryable } from "@aiops/shared";
import type { PersonaResolver, ResolvedPersona } from "../personaResolver";
import { ForbiddenError } from "../authGuard";
import { resolvePersonas, toErrorResponse } from "./dataApiSupport";
import { buildAgentActivitySummary } from "./agentActivityData";

export interface AgentActivityHandlerDeps {
  getSession: () => Promise<Session | null>;
  resolver: PersonaResolver;
  devopsDb: PgQueryable;
  selectedPersona?: string;
}

/**
 * ResolvedPersonaは domain によるユニオン型だが、Array.prototype.find は述語内の絞り込みを
 * 戻り値の型へ伝播しない（TSの既知の制約）ため、型ガード関数で明示的に絞り込む。
 */
function isDevopsManager(p: ResolvedPersona): p is Extract<ResolvedPersona, { domain: "devops" }> {
  return p.domain === "devops" && p.profile === "PRF-G";
}

export async function handleAgentActivity(deps: AgentActivityHandlerDeps): Promise<Response> {
  try {
    const personas = await resolvePersonas(deps.getSession, deps.resolver, "devops", deps.selectedPersona);
    const devopsManager = personas.find(isDevopsManager);
    if (!devopsManager) {
      throw new ForbiddenError("E-AUTH02: agent-activity requires PRF-G persona");
    }
    const summary = await buildAgentActivitySummary(deps.devopsDb, devopsManager.profile, devopsManager.visibility);
    return Response.json(summary);
  } catch (err) {
    return toErrorResponse(err);
  }
}
