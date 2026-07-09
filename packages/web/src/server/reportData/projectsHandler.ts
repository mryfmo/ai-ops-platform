/**
 * packages/web/src/server/reportData/projectsHandler.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。GET /api/data/projects のハンドラ本体。
 *   全ペルソナ共通。スコープ内プロジェクト一覧を {id,name}[] のみで返す（数値を一切含まない）。
 *
 * 認可: requireSession（未認証401）→ requirePersona()（該当ペルソナなし403）を経由する。
 *   先頭のペルソナ（複数ペルソナを持つ場合の切替UIは次フェーズ残課題）のドメインに応じて
 *   プロジェクト一覧を取得する。
 *
 * DIを引数で受け取る設計（getSession/resolver/prjopsProvider/devopsDb）にすることで、
 * route.ts（本番配線）と切り離してネットワーク・実DBなしでテストできる。
 */
import type { Session } from "next-auth";
import type { PgQueryable } from "@aiops/shared";
import type { PersonaResolver } from "../personaResolver";
import { resolvePersonas, toErrorResponse } from "./dataApiSupport";
import { listScopedProjectSummaries, type PrjopsReportDataProvider } from "./prjopsReportData";
import { listDevOpsScopedProjectSummaries } from "./devopsReportData";

export interface ProjectsHandlerDeps {
  getSession: () => Promise<Session | null>;
  resolver: PersonaResolver;
  prjopsProvider: PrjopsReportDataProvider;
  devopsDb: PgQueryable;
}

export async function handleProjects(deps: ProjectsHandlerDeps): Promise<Response> {
  try {
    const personas = await resolvePersonas(deps.getSession, deps.resolver);
    const persona = personas[0]!;

    if (persona.domain === "prjops") {
      const projects = await listScopedProjectSummaries(deps.prjopsProvider, persona.profile, persona.visibility);
      return Response.json({ domain: "prjops", projects });
    }

    const projects = await listDevOpsScopedProjectSummaries(deps.devopsDb, persona.profile, persona.visibility);
    return Response.json({ domain: "devops", projects });
  } catch (err) {
    return toErrorResponse(err);
  }
}
