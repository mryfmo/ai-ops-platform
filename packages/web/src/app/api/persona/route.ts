/**
 * packages/web/src/app/api/persona/route.ts
 *
 * 根拠: P010-F02-T08 / ADR-0005 / AUD-IMP-006。認証ユーザーの現在の保有ペルソナだけを選択状態として保存する。
 */
import { auth } from "../../../auth";
import { loadWebConfig } from "../../../server/config";
import { getPool } from "../../../server/db/pool";
import { CompositePersonaResolver, DevopsPersonaSource, PrjopsPersonaSource } from "../../../server/personaResolver";
import { handlePersonaSelection } from "../../../server/personaSelectionHandler";
import { createPinnedPrjopsReportDataProvider } from "../../../server/reportData/pinnedPrjopsReportDataProvider";
import { toErrorResponse } from "../../../server/reportData/dataApiSupport";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "E-ORIGIN01: same-origin request required" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "E-PERSONA01: persona must be a non-empty string" }, { status: 400 });
  }
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    typeof (body as { persona?: unknown }).persona !== "string" ||
    (body as { persona: string }).persona.length === 0
  ) {
    return Response.json({ error: "E-PERSONA01: persona must be a non-empty string" }, { status: 400 });
  }

  const config = loadWebConfig();
  const pool = getPool(config.DATABASE_URL);
  let provider;
  try {
    provider = createPinnedPrjopsReportDataProvider(config);
  } catch (error) {
    return toErrorResponse(error);
  }
  const resolver = new CompositePersonaResolver(new DevopsPersonaSource(pool), new PrjopsPersonaSource(provider));
  return handlePersonaSelection({
    getSession: async () => auth(),
    resolver,
    selectedPersona: (body as { persona: string }).persona,
    secureCookie: process.env.NODE_ENV === "production",
  });
}
