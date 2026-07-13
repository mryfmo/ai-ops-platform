/**
 * packages/web/src/server/reportData/executiveSummaryHandler.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。GET /api/data/executive-summary のハンドラ本体。
 *   PRF-04（経営陣）専用。セブンキーの数値4項目を返す。
 *
 * 認可: requireSession（未認証401）→ requirePersona(domain="prjops")（該当ペルソナなし403）を
 *   必ず経由する。取得したペルソナにPRF-04が含まれない場合も403（このAPIはPRF-04専用）。
 *
 * DIを引数で受け取る設計（getSession/resolver/provider）にすることで、
 * route.ts（本番配線）と切り離してネットワーク・実DBなしでテストできる
 * （既存 authGuard.ts の requireSession(getSession) パターン踏襲。CLAUDE.md設計原則7）。
 */
import type { Session } from "next-auth";
import type { PersonaResolver, ResolvedPersona } from "../personaResolver";
import { ForbiddenError } from "../authGuard";
import { resolvePersonas, toErrorResponse } from "./dataApiSupport";
import { buildExecutiveSummary, type PrjopsReportDataProvider } from "./prjopsReportData";

export interface ExecutiveSummaryHandlerDeps {
  getSession: () => Promise<Session | null>;
  resolver: PersonaResolver;
  provider: PrjopsReportDataProvider;
  selectedPersona?: string;
}

/**
 * ResolvedPersonaは domain によるユニオン型だが、Array.prototype.find は述語内の絞り込みを
 * 戻り値の型へ伝播しない（TSの既知の制約）ため、型ガード関数で明示的に絞り込む。
 */
function isPrjopsExecutive(p: ResolvedPersona): p is Extract<ResolvedPersona, { domain: "prjops" }> {
  return p.domain === "prjops" && p.profile === "PRF-04";
}

export async function handleExecutiveSummary(deps: ExecutiveSummaryHandlerDeps): Promise<Response> {
  try {
    const personas = await resolvePersonas(deps.getSession, deps.resolver, "prjops", deps.selectedPersona);
    const executivePersona = personas.find(isPrjopsExecutive);
    if (!executivePersona) {
      throw new ForbiddenError("E-AUTH02: executive-summary requires PRF-04 persona");
    }
    const summary = await buildExecutiveSummary(deps.provider, executivePersona.profile, executivePersona.visibility);
    return Response.json(summary);
  } catch (err) {
    return toErrorResponse(err);
  }
}
