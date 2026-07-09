/**
 * packages/web/src/components/views/ExecutiveSevenKeysView.tsx
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。経営層（PRF-04）ダッシュボードの主指標
 *   「セブンキー」を表示するビューコンポーネント。
 *   1〜5（ポートフォリオ健康度・進捗達成率・高リスク課題件数・予算消化率・スケジュール遵守率）は
 *   決定的にコード算出済みの数値（packages/prjops/src/lib/executiveSevenKeys.ts）をそのまま表示する。
 *   6（前月比変動）・7（トップリスクトピックス）は既存ExecutiveReportData同様、LLM生成文字列
 *   （本タスクでは固定文字列のスタブ）をそのまま表示する付随情報。
 *
 * 予算消化率（指標4）はpackages/prjopsに予算フィールドが存在しないためnullを許容し、
 * null時は「データ未整備」バッジを表示する（CLAUDE.md方針: 数値はコード算出、無い場合は
 * 隠さずデータ未整備であることを明示する）。
 */
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { StatusChip } from "../ui/StatusChip";

export interface ExecutiveSevenKeysData {
  colorDistribution: { green: number; yellow: number; red: number };
  progressAchievementPct: number;
  highRiskIssueCount: number;
  budgetConsumptionPct: number | null;
  scheduleAdherencePct: number;
  /** 6. 前月比変動（LLM生成文字列。本タスクでは固定文字列のスタブ） */
  monthOverMonthDiffText: string;
  /** 7. トップリスクトピックス（LLM生成文字列。本タスクでは固定文字列のスタブ） */
  topTopics: Array<{ title: string; lines: [string, string] }>;
}

export interface ExecutiveSevenKeysViewProps {
  data: ExecutiveSevenKeysData;
}

function pctLabel(pct: number): string {
  return `${pct.toFixed(1)}%`;
}

export function ExecutiveSevenKeysView({ data }: ExecutiveSevenKeysViewProps) {
  const total = data.colorDistribution.green + data.colorDistribution.yellow + data.colorDistribution.red;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">経営ダッシュボード（セブンキー）</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card title="1. ポートフォリオ健康度" className="lg:col-span-1">
          <div className="flex items-center gap-3">
            <StatusChip status="green" />
            <span className="text-sm text-gray-700">{data.colorDistribution.green}</span>
            <StatusChip status="yellow" />
            <span className="text-sm text-gray-700">{data.colorDistribution.yellow}</span>
            <StatusChip status="red" />
            <span className="text-sm text-gray-700">{data.colorDistribution.red}</span>
          </div>
          <p className="mt-2 text-xs text-gray-500">全{total}件</p>
        </Card>

        <Card title="2. 進捗達成率">
          <p className="text-3xl font-bold text-gray-800">{pctLabel(data.progressAchievementPct)}</p>
        </Card>

        <Card title="3. 高リスク課題件数">
          <p className="text-3xl font-bold text-gray-800">{data.highRiskIssueCount}件</p>
        </Card>

        <Card title="4. 予算消化率">
          {data.budgetConsumptionPct === null ? (
            <Badge variant="default">データ未整備</Badge>
          ) : (
            <p className="text-3xl font-bold text-gray-800">{pctLabel(data.budgetConsumptionPct)}</p>
          )}
        </Card>

        <Card title="5. スケジュール遵守率">
          <p className="text-3xl font-bold text-gray-800">{pctLabel(data.scheduleAdherencePct)}</p>
        </Card>

        <Card title="6. 前月比変動">
          <p className="text-sm text-gray-700">{data.monthOverMonthDiffText}</p>
        </Card>
      </div>

      <Card title="7. トップリスクトピックス">
        {data.topTopics.length === 0 ? (
          <p className="text-sm text-gray-500">該当するトピックはありません</p>
        ) : (
          <ul className="space-y-3">
            {data.topTopics.map((topic) => (
              <li key={topic.title}>
                <p className="font-semibold text-gray-800">{topic.title}</p>
                <p className="text-sm text-gray-600">{topic.lines[0]}</p>
                <p className="text-sm text-gray-600">{topic.lines[1]}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
