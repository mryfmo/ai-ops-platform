/**
 * packages/web/src/app/dashboard/page.tsx
 *
 * 根拠: P010-F02-T08 / ADR-0005 / DevOps:SPEC-INT-054。resolveBySubject結果と検証済みの選択ペルソナに応じて
 *   ペルソナ別ビューの初期データを取得するサーバーコンポーネント。
 *
 *   - PRF-04（経営陣）: ExecutiveSevenKeysView（セブンキー）
 *   - PRF-03（PrjOpsマネージャー）/ PRF-G（DevOpsマネージャー）: ManagerSummaryView
 *   - その他（PRF-01/02/05, PRF-M/L）: 準備中の簡易表示（#14で拡充）
 *
 *   初期データ取得後は <DashboardClient> （クライアントコンポーネント）へ委譲し、
 *   ChatPanelによる動的表示切替（#14）を可能にする。ChatPanelは
 *   ペルソナに応じて公開されるtool（buildToolsForPersona参照）によりshowExecutiveSummary /
 *   showManagerSummary / listProjects を呼び分ける。
 *
 * production compositionは共有pg.Poolとpinned PrjOps providerを全表示で共用する。
 */
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "../../auth";
import { Card } from "../../components/ui/Card";
import { DashboardClient } from "../../components/DashboardClient";
import { PersonaSelector } from "../../components/PersonaSelector";
import { loadWebConfig } from "../../server/config";
import { getPool } from "../../server/db/pool";
import {
  ConflictError,
  ForbiddenError,
  PERSONA_COOKIE,
  UnauthorizedError,
  personaKey,
  requireSession,
  selectPersona,
} from "../../server/authGuard";
import { CompositePersonaResolver, DevopsPersonaSource, PrjopsPersonaSource } from "../../server/personaResolver";
import {
  buildExecutiveSummary,
  buildInvestorSummary,
  buildManagerSummary,
} from "../../server/reportData/prjopsReportData";
import { buildDevOpsManagerSummary } from "../../server/reportData/devopsReportData";
import {
  createPinnedPrjopsReportDataProvider,
  PrjopsDataUnavailableError,
} from "../../server/reportData/pinnedPrjopsReportDataProvider";

function defaultPeriod(): { periodStart: string; periodEnd: string } {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - 28 * 24 * 60 * 60 * 1000);
  return { periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString() };
}

export default async function DashboardPage() {
  let session;
  try {
    session = await requireSession(auth);
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login");
    throw error;
  }

  const config = loadWebConfig();
  const pool = getPool(config.DATABASE_URL);
  let provider;
  try {
    provider = createPinnedPrjopsReportDataProvider(config);
  } catch (error) {
    if (!(error instanceof PrjopsDataUnavailableError)) throw error;
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <Card title="PrjOps データを利用できません">
          <p className="text-sm text-gray-600">データ接続の設定を確認してください。</p>
        </Card>
      </div>
    );
  }
  const resolver = new CompositePersonaResolver(new DevopsPersonaSource(pool), new PrjopsPersonaSource(provider));
  const personas = await resolver.resolveBySubject(session.user.subject);

  if (personas.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <Card title="表示できるペルソナがありません">
          <p className="text-sm text-gray-600">現在利用できる割り当てが見つかりませんでした。</p>
        </Card>
      </div>
    );
  }

  const selectedPersona = (await cookies()).get(PERSONA_COOKIE)?.value;
  const options = personas.map((persona) => ({
    key: personaKey(persona),
    label: `${persona.domain === "prjops" ? "PrjOps" : persona.domain === "devops" ? "DevOps" : "Investor"} ${
      persona.profile
    } (${persona.scope.mode === "global" ? "global" : persona.scope.projectId})`,
  }));
  let persona;
  try {
    persona = selectPersona(personas, selectedPersona);
  } catch (err) {
    if (!(err instanceof ForbiddenError) && !(err instanceof ConflictError)) throw err;
    return (
      <div className="space-y-6">
        <PersonaSelector options={options} />
        <Card title={err instanceof ConflictError ? "ペルソナを選択してください" : "選択したペルソナを利用できません"}>
          <p className="text-sm text-gray-600">現在利用できる割り当てから選択してください。</p>
        </Card>
      </div>
    );
  }
  const selector = <PersonaSelector options={options} selectedKey={personaKey(persona)} />;
  const { periodStart, periodEnd } = defaultPeriod();

  if (persona.domain === "prjops" && persona.profile === "PRF-04") {
    const numeric = await buildExecutiveSummary(provider, persona.profile, persona.visibility);
    return (
      <>
        {selector}
        <DashboardClient
          initialViewSpec={{ kind: "executiveSummary" }}
          initialData={{
            kind: "executiveSummary",
            data: numeric,
          }}
        />
      </>
    );
  }

  if (persona.domain === "investor") {
    const summary = await buildInvestorSummary(provider, persona.visibility);
    return (
      <>
        {selector}
        <DashboardClient
          initialViewSpec={{ kind: "investorSummary" }}
          initialData={{ kind: "investorSummary", data: summary }}
        />
      </>
    );
  }

  if (persona.domain === "prjops" && persona.profile === "PRF-03") {
    const summary = await buildManagerSummary(provider, persona.profile, persona.visibility, periodStart, periodEnd);
    return (
      <>
        {selector}
        <DashboardClient
          initialViewSpec={{ kind: "managerSummary" }}
          initialData={{ kind: "managerSummary", domain: "prjops", data: summary }}
        />
      </>
    );
  }

  if (persona.domain === "devops" && persona.profile === "PRF-G") {
    const summary = await buildDevOpsManagerSummary(pool, persona.profile, persona.visibility, periodStart, periodEnd);
    return (
      <>
        {selector}
        <DashboardClient
          initialViewSpec={{ kind: "managerSummary" }}
          initialData={{
            kind: "managerSummary",
            domain: "devops",
            data: {
              totalProjectCount: summary.totalProjectCount,
              projects: summary.projectIds.map((id) => ({ projectId: id, name: id, periodLabel: "-", ownerName: "-" })),
              totalTicketCount: summary.totalTicketCount,
              remainingTicketCount: summary.remainingTicketCount,
              burndown: summary.burndown,
              velocity: summary.velocity,
              coveragePct: summary.coveragePct,
              dora: summary.dora,
              doraByProject: summary.doraByProject,
            },
          }}
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      {selector}
      <h1 className="text-2xl font-bold">ダッシュボード</h1>
      <Card
        title={`${persona.domain === "prjops" ? "PrjOps" : persona.domain === "devops" ? "DevOps" : "Investor"} ${
          persona.profile
        }`}
      >
        <p className="text-sm text-gray-600">対応するビューは準備中です（次フェーズ#14で拡充予定）。</p>
      </Card>
    </div>
  );
}
