/**
 * packages/web/src/app/api/persona/route.ts
 *
 * 根拠: ADR-0005 / AUD-IMP-006。認証ユーザーの現在の保有ペルソナだけを選択状態として保存する。
 */
import pg from "pg";
import { auth } from "../../../auth";
import { loadWebConfig } from "../../../server/config";
import {
  CompositePersonaResolver,
  DevopsPersonaSource,
  InMemoryStakeholderMasterProvider,
  PrjopsPersonaSource,
} from "../../../server/personaResolver";
import { handlePersonaSelection } from "../../../server/personaSelectionHandler";

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
  const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
  const resolver = new CompositePersonaResolver(
    new DevopsPersonaSource(pool),
    new PrjopsPersonaSource(new InMemoryStakeholderMasterProvider([])),
  );
  return handlePersonaSelection({
    getSession: async () => auth(),
    resolver,
    selectedPersona: (body as { persona: string }).persona,
    secureCookie: process.env.NODE_ENV === "production",
  });
}
