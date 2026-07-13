/**
 * packages/web/src/server/reportData/managerSummaryHandler.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。GET /api/data/manager-summary のハンドラ本体。
 *   PrjOps PRF-03 または DevOps PRF-G 専用。総プロジェクト数・チケット数・バーンダウン
 *   データを返す。
 *
 * 認可: requireSession（未認証401）→ requirePersona()（domain指定なし。両ドメインの
 *   ペルソナを許容する）（該当ペルソナなし403）を経由する。取得したペルソナに
 *   PRF-03/PRF-Gがいずれも含まれない場合も403。
 *   選択ペルソナがある場合はその1件を使用し、未選択時のみPrjOps(PRF-03)を優先する。
 *
 * DIを引数で受け取る設計（getSession/resolver/prjopsProvider/devopsDb）にすることで、
 * route.ts（本番配線）と切り離してネットワーク・実DBなしでテストできる。
 */
import type { Session } from "next-auth";
import type { PgQueryable } from "@aiops/shared";
import type { PersonaResolver, ResolvedPersona } from "../personaResolver";
import { ForbiddenError } from "../authGuard";
import { resolvePersonas, toErrorResponse } from "./dataApiSupport";
import { buildManagerSummary, type PrjopsReportDataProvider } from "./prjopsReportData";
import { buildDevOpsManagerSummary } from "./devopsReportData";

export interface ManagerSummaryHandlerDeps {
  getSession: () => Promise<Session | null>;
  resolver: PersonaResolver;
  prjopsProvider: PrjopsReportDataProvider;
  devopsDb: PgQueryable;
  /** 集計期間（ISO日付文字列）。未指定時は呼び出し側のroute.tsが既定期間（直近28日）を渡す。 */
  periodStart: string;
  periodEnd: string;
  selectedPersona?: string;
}

/**
 * ResolvedPersonaは domain によるユニオン型だが、Array.prototype.find は述語内の絞り込みを
 * 戻り値の型へ伝播しない（TSの既知の制約）ため、型ガード関数で明示的に絞り込む。
 */
function isPrjopsManager(p: ResolvedPersona): p is Extract<ResolvedPersona, { domain: "prjops" }> {
  return p.domain === "prjops" && p.profile === "PRF-03";
}
function isDevopsManager(p: ResolvedPersona): p is Extract<ResolvedPersona, { domain: "devops" }> {
  return p.domain === "devops" && p.profile === "PRF-G";
}

export async function handleManagerSummary(deps: ManagerSummaryHandlerDeps): Promise<Response> {
  try {
    const personas = await resolvePersonas(deps.getSession, deps.resolver, undefined, deps.selectedPersona);
    const prjopsManager = personas.find(isPrjopsManager);
    const devopsManager = personas.find(isDevopsManager);
    if (!prjopsManager && !devopsManager) {
      throw new ForbiddenError("E-AUTH02: manager-summary requires PRF-03 or PRF-G persona");
    }

    if (prjopsManager) {
      const summary = await buildManagerSummary(
        deps.prjopsProvider,
        prjopsManager.profile,
        prjopsManager.visibility,
        deps.periodStart,
        deps.periodEnd,
      );
      return Response.json({ domain: "prjops", ...summary });
    }

    const summary = await buildDevOpsManagerSummary(
      deps.devopsDb,
      devopsManager!.profile,
      devopsManager!.visibility,
      deps.periodStart,
      deps.periodEnd,
    );
    return Response.json({ domain: "devops", ...summary });
  } catch (err) {
    return toErrorResponse(err);
  }
}
