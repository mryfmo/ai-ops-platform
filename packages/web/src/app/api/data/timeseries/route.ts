/**
 * packages/web/src/app/api/data/timeseries/route.ts
 *
 * 根拠: ADR-0007 / REQ-036 / SPEC-INT-062 / REQ-031 / SPEC-INT-081。
 */
import { auth } from "../../../../auth";
import { loadWebConfig } from "../../../../server/config";
import { getPool } from "../../../../server/db/pool";
import {
  CompositePersonaResolver,
  DevopsPersonaSource,
  InMemoryStakeholderMasterProvider,
  PrjopsPersonaSource,
} from "../../../../server/personaResolver";
import { handleTimeseries } from "../../../../server/reportData/timeseriesHandler";
import type { PeriodKind } from "@aiops/shared";

export const dynamic = "force-dynamic";

const PERIODS = new Set(["week", "month", "quarter", "half", "year"]);

export async function GET(request: Request): Promise<Response> {
  const config = loadWebConfig();
  const pool = getPool(config.DATABASE_URL);
  const resolver = new CompositePersonaResolver(
    new DevopsPersonaSource(pool),
    new PrjopsPersonaSource(new InMemoryStakeholderMasterProvider([])),
  );
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
  });
}
