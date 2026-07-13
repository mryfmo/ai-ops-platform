/**
 * packages/web/src/app/dashboard/page.tsx
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。resolveByEmail結果と検証済みの選択ペルソナに応じて
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
 * DIの暫定実装（共有pg.Pool取得・InMemoryStakeholderMasterProvider・
 * InMemoryPrjopsReportDataProvider）は既存の方式を踏襲する。
 * 残課題: PrjopsReportDataProviderの本番実装（prjops-dataリポジトリ連携）が無いため、
 * 現状は空データで暫定配線する（表示自体はゼロ件のセブンキー/マネージャーサマリになる）。
 */
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "../../auth";
import { Card } from "../../components/ui/Card";
import { DashboardClient } from "../../components/DashboardClient";
import { PersonaSelector } from "../../components/PersonaSelector";
import { loadWebConfig } from "../../server/config";
import { getPool } from "../../server/db/pool";
import { ForbiddenError, PERSONA_COOKIE, personaKey, selectPersona } from "../../server/authGuard";
import {
  CompositePersonaResolver,
  DevopsPersonaSource,
  InMemoryStakeholderMasterProvider,
  PrjopsPersonaSource,
} from "../../server/personaResolver";
import {
  InMemoryPrjopsReportDataProvider,
  buildExecutiveSummary,
  buildInvestorSummary,
  buildManagerSummary,
} from "../../server/reportData/prjopsReportData";
import { buildDevOpsManagerSummary } from "../../server/reportData/devopsReportData";

function defaultPeriod(): { periodStart: string; periodEnd: string } {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - 28 * 24 * 60 * 60 * 1000);
  return { periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString() };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/login");
  }

  const config = loadWebConfig();
  const pool = getPool(config.DATABASE_URL);
  const resolver = new CompositePersonaResolver(
    new DevopsPersonaSource(pool),
    new PrjopsPersonaSource(new InMemoryStakeholderMasterProvider([])),
  );
  const personas = await resolver.resolveByEmail(session.user.email);

  if (personas.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <Card title="表示できるペルソナがありません">
          <p className="text-sm text-gray-600">{session.user.email} に紐づくペルソナが見つかりませんでした。</p>
        </Card>
      </div>
    );
  }

  const selectedPersona = (await cookies()).get(PERSONA_COOKIE)?.value;
  const options = personas.map((persona) => ({
    key: personaKey(persona),
    label: `${persona.domain === "prjops" ? "PrjOps" : persona.domain === "devops" ? "DevOps" : "Investor"} ${persona.profile}`,
  }));
  let persona;
  try {
    persona = selectPersona(personas, selectedPersona);
  } catch (err) {
    if (!(err instanceof ForbiddenError)) throw err;
    return (
      <div className="space-y-6">
        <PersonaSelector options={options} />
        <Card title="選択したペルソナを利用できません">
          <p className="text-sm text-gray-600">現在割り当てられているペルソナを選び直してください。</p>
        </Card>
      </div>
    );
  }
  const selector = <PersonaSelector options={options} selectedKey={personaKey(persona)} />;
  const { periodStart, periodEnd } = defaultPeriod();

  if (persona.domain === "prjops" && persona.profile === "PRF-04") {
    const provider = new InMemoryPrjopsReportDataProvider([], []);
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
    const provider = new InMemoryPrjopsReportDataProvider([], []);
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
    const provider = new InMemoryPrjopsReportDataProvider([], []);
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
