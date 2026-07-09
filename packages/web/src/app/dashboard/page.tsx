/**
 * packages/web/src/app/dashboard/page.tsx
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。resolveByEmail結果の先頭ペルソナに応じてペルソナ別
 *   ビューの初期データを取得するサーバーコンポーネント。複数ペルソナを持つアカウントの
 *   切替UIは次フェーズ（#14）の残課題であり、本タスクでは先頭のペルソナのみを採用する。
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
 * DIの暫定実装（pg.Pool生成・InMemoryStakeholderMasterProvider・
 * InMemoryPrjopsReportDataProvider）は既存の方式を踏襲する。
 * 残課題: PrjopsReportDataProviderの本番実装（prjops-dataリポジトリ連携）が無いため、
 * 現状は空データで暫定配線する（表示自体はゼロ件のセブンキー/マネージャーサマリになる）。
 */
import { redirect } from "next/navigation";
import pg from "pg";
import { auth } from "../../auth";
import { Card } from "../../components/ui/Card";
import { DashboardClient } from "../../components/DashboardClient";
import { loadWebConfig } from "../../server/config";
import {
  CompositePersonaResolver,
  DevopsPersonaSource,
  InMemoryStakeholderMasterProvider,
  PrjopsPersonaSource,
} from "../../server/personaResolver";
import {
  InMemoryPrjopsReportDataProvider,
  buildExecutiveSummary,
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
  const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
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

  // 残課題(#14): 複数ペルソナ切替UIは未実装。先頭のペルソナのみを採用する。
  const persona = personas[0]!;
  const { periodStart, periodEnd } = defaultPeriod();

  if (persona.domain === "prjops" && persona.profile === "PRF-04") {
    const provider = new InMemoryPrjopsReportDataProvider([], []);
    const numeric = await buildExecutiveSummary(provider, persona.profile, persona.visibility);
    return (
      <DashboardClient
        initialViewSpec={{ kind: "executiveSummary" }}
        initialData={{
          kind: "executiveSummary",
          data: {
            ...numeric,
            monthOverMonthDiffText: "前月比データは準備中です（スタブ表示）。",
            topTopics: [],
          },
        }}
      />
    );
  }

  if (persona.domain === "prjops" && persona.profile === "PRF-03") {
    const provider = new InMemoryPrjopsReportDataProvider([], []);
    const summary = await buildManagerSummary(provider, persona.profile, persona.visibility, periodStart, periodEnd);
    return (
      <DashboardClient
        initialViewSpec={{ kind: "managerSummary" }}
        initialData={{ kind: "managerSummary", domain: "prjops", data: summary }}
      />
    );
  }

  if (persona.domain === "devops" && persona.profile === "PRF-G") {
    const summary = await buildDevOpsManagerSummary(pool, persona.profile, persona.visibility, periodStart, periodEnd);
    return (
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
          },
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ダッシュボード</h1>
      <Card title={`${persona.domain === "prjops" ? "PrjOps" : "DevOps"} ${persona.profile}`}>
        <p className="text-sm text-gray-600">対応するビューは準備中です（次フェーズ#14で拡充予定）。</p>
      </Card>
    </div>
  );
}
