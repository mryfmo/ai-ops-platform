/**
 * packages/web/src/server/reportData/projectsHandler.ts
 *
 * 根拠: P010-F02-T10 / DEC-SPEC-008 / ADR-0005（WebUIダッシュボード）。
 * GET /api/data/projects のハンドラ本体。
 *   全ペルソナ共通。スコープ内プロジェクト一覧を {id,name}[] のみで返す（数値を一切含まない）。
 *
 * 認可: requireSession（未認証401）→ requirePersona()（該当ペルソナなし403）を経由する。
 *   検証済みの選択ペルソナ（未選択時は先頭）のドメインに応じてプロジェクト一覧を取得する。
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
import { canonicalProjectOptions, portfolioAllowedForPersona } from "../projectSelection";

export interface ProjectsHandlerDeps {
  getSession: () => Promise<Session | null>;
  resolver: PersonaResolver;
  prjopsProvider: PrjopsReportDataProvider;
  devopsDb: PgQueryable;
  selectedPersona?: string;
}

export function rejectUnexpectedProjectParameter(request?: Request): Response | undefined {
  if (request && new URL(request.url).searchParams.has("project")) {
    return Response.json({ error: "E-AUTH05: unexpected_project_parameter" }, { status: 400 });
  }
  return undefined;
}

export async function handleProjects(deps: ProjectsHandlerDeps, request?: Request): Promise<Response> {
  try {
    const rejection = rejectUnexpectedProjectParameter(request);
    if (rejection) return rejection;
    const [persona] = await resolvePersonas(deps.getSession, deps.resolver, undefined, deps.selectedPersona);
    const portfolioAllowed = portfolioAllowedForPersona(persona!);

    if (persona!.domain === "prjops") {
      const projects = await listScopedProjectSummaries(deps.prjopsProvider, persona!.profile, persona!.visibility);
      return Response.json({ domain: "prjops", projects: canonicalProjectOptions(projects), portfolioAllowed });
    }
    if (persona!.domain === "investor") {
      const projects = await listScopedProjectSummaries(deps.prjopsProvider, "PRF-05", persona!.visibility);
      return Response.json({ domain: "investor", projects: canonicalProjectOptions(projects), portfolioAllowed });
    }

    const projects = await listDevOpsScopedProjectSummaries(deps.devopsDb, persona!.profile, persona!.visibility);
    return Response.json({ domain: "devops", projects: canonicalProjectOptions(projects), portfolioAllowed });
  } catch (err) {
    return toErrorResponse(err);
  }
}
