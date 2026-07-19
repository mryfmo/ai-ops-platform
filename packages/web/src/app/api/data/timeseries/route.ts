/**
 * packages/web/src/app/api/data/timeseries/route.ts
 *
 * 根拠: P010-F02-T08 / ADR-0007 / REQ-036 / PrjOps:SPEC-INT-062 / DevOps:REQ-031 / SPEC-INT-081。
 */
import { auth } from "../../../../auth";
import { loadWebConfig } from "../../../../server/config";
import { getPool } from "../../../../server/db/pool";
import { CompositePersonaResolver, DevopsPersonaSource, PrjopsPersonaSource } from "../../../../server/personaResolver";
import { handleTimeseries } from "../../../../server/reportData/timeseriesHandler";
import type { PeriodKind } from "@aiops/shared";
import { selectedPersonaFromRequest } from "../../../../server/authGuard";
import { createPinnedPrjopsReportDataProvider } from "../../../../server/reportData/pinnedPrjopsReportDataProvider";
import { toErrorResponse } from "../../../../server/reportData/dataApiSupport";

export const dynamic = "force-dynamic";

const PERIODS = new Set(["week", "month", "quarter", "half", "year"]);

export async function GET(request: Request): Promise<Response> {
  const config = loadWebConfig();
  const pool = getPool(config.DATABASE_URL);
  let provider;
  try {
    provider = createPinnedPrjopsReportDataProvider(config);
  } catch (error) {
    return toErrorResponse(error);
  }
  const resolver = new CompositePersonaResolver(new DevopsPersonaSource(pool), new PrjopsPersonaSource(provider));
  const url = new URL(request.url);
  const periodParam = url.searchParams.get("period") ?? "month";
  const period = (PERIODS.has(periodParam) ? periodParam : "month") as PeriodKind;
  return handleTimeseries({
    getSession: async () => auth(),
    resolver,
    db: pool,
    period,
    baseDate: url.searchParams.get("baseDate") ?? new Date().toISOString().slice(0, 10),
    persona: (url.searchParams.get("persona") ?? undefined) as "executive" | "manager" | "investor" | undefined,
    selectedPersona: selectedPersonaFromRequest(request),
  });
}
