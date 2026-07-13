/**
 * packages/web/src/server/reportData/investorSummaryHandler.ts
 *
 * 根拠: REQ-039 / SPEC-INT-066 / AC-039-1 / ADR-0011。
 */
import type { Session } from "next-auth";
import type { PersonaResolver, ResolvedPersona } from "../personaResolver";
import { ForbiddenError } from "../authGuard";
import { resolvePersonas, toErrorResponse } from "./dataApiSupport";
import { buildInvestorSummary, type PrjopsReportDataProvider } from "./prjopsReportData";

export interface InvestorSummaryHandlerDeps {
  getSession: () => Promise<Session | null>;
  resolver: PersonaResolver;
  provider: PrjopsReportDataProvider;
  selectedPersona?: string;
}

function isInvestor(p: ResolvedPersona): p is Extract<ResolvedPersona, { domain: "investor" }> {
  return p.domain === "investor" && p.profile === "investor";
}

export async function handleInvestorSummary(deps: InvestorSummaryHandlerDeps): Promise<Response> {
  try {
    const personas = await resolvePersonas(deps.getSession, deps.resolver, "investor", deps.selectedPersona);
    const investor = personas.find(isInvestor);
    if (!investor) throw new ForbiddenError("E-AUTH02: investor-summary requires investor persona");
    return Response.json(await buildInvestorSummary(deps.provider, investor.visibility));
  } catch (err) {
    return toErrorResponse(err);
  }
}
