/**
 * packages/devops/src/lib/incidentBurndown.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。マネージャー層（PRF-G）ダッシュボードの主指標の一つ
 *   「バーンダウンチャート」を算出する純粋関数。
 *
 * チケットの定義（本タスクでの解釈）: DevOpsドメインには「チケット」に相当する専用エンティティが
 *   存在しないため、既存の incidents テーブル（packages/devops/src/db/schema.sql）を
 *   総チケット数=期間内の全incidents件数、残チケット数=resolved_at IS NULLの件数、として扱う。
 *   この解釈はCLAUDE.mdの指示に基づく暫定実装であり、本来のチケット管理システムとの連携は
 *   本タスクの範囲外（残課題）。
 *
 * 週次バケット集計方式: 期間の開始日を起点に7日単位でバケットを区切り、各週について
 *   - opened: その週内にdetected_atが属するincident件数
 *   - resolved: その週内にresolved_atが属するincident件数
 *   - remaining: 累積オープン件数（週末時点で resolved_at が未到来、または null のincident数）
 *   を算出する。CLAUDE.md設計原則2に従いLLMは一切使用しない決定的計算。
 */

export interface IncidentBurndownInput {
  detectedAt: string; // ISO 8601
  resolvedAt: string | null; // ISO 8601 または未解決ならnull
}

export interface BurndownWeek {
  weekLabel: string;
  opened: number;
  resolved: number;
  remaining: number;
}

function toEpochMs(iso: string): number {
  return Date.parse(iso);
}

/** periodStart起点でのbucket index（0始まり、7日単位）。範囲外はnullを返す。 */
function bucketIndex(iso: string | null, periodStartMs: number, weekMs: number, weekCount: number): number | null {
  if (iso === null) return null;
  const ms = toEpochMs(iso);
  const idx = Math.floor((ms - periodStartMs) / weekMs);
  if (idx < 0 || idx >= weekCount) return null;
  return idx;
}

function formatWeekLabel(startMs: number, index: number, weekMs: number): string {
  const d = new Date(startMs + index * weekMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * incidentsを週次バケットに集計し、累積オープン件数の推移（バーンダウン）を返す。
 * periodStart/periodEnd（ISO 8601日付文字列。時刻は00:00:00Z想定）で期間を指定する。
 * periodEndがperiodStart以前、または不正な期間の場合は空配列を返す。
 */
export function computeIncidentBurndown(
  incidents: IncidentBurndownInput[],
  periodStart: string,
  periodEnd: string,
): BurndownWeek[] {
  const startMs = toEpochMs(periodStart);
  const endMs = toEpochMs(periodEnd);
  if (!(endMs > startMs)) return [];

  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const weekCount = Math.max(1, Math.ceil((endMs - startMs) / weekMs));

  const openedCounts = new Array<number>(weekCount).fill(0);
  const resolvedCounts = new Array<number>(weekCount).fill(0);
  let openingBacklog = 0;

  for (const inc of incidents) {
    const detectedMs = toEpochMs(inc.detectedAt);
    const resolvedMs = inc.resolvedAt === null ? null : toEpochMs(inc.resolvedAt);
    if (detectedMs < startMs && (resolvedMs === null || resolvedMs >= startMs)) openingBacklog += 1;
    const openedIdx = bucketIndex(inc.detectedAt, startMs, weekMs, weekCount);
    if (openedIdx !== null) openedCounts[openedIdx] = openedCounts[openedIdx]! + 1;

    const resolvedIdx = bucketIndex(inc.resolvedAt, startMs, weekMs, weekCount);
    if (resolvedIdx !== null) resolvedCounts[resolvedIdx] = resolvedCounts[resolvedIdx]! + 1;
  }

  const weeks: BurndownWeek[] = [];
  let cumulativeOpened = openingBacklog;
  let cumulativeResolved = 0;
  for (let i = 0; i < weekCount; i++) {
    cumulativeOpened += openedCounts[i]!;
    cumulativeResolved += resolvedCounts[i]!;
    weeks.push({
      weekLabel: formatWeekLabel(startMs, i, weekMs),
      opened: openedCounts[i]!,
      resolved: resolvedCounts[i]!,
      remaining: cumulativeOpened - cumulativeResolved,
    });
  }
  return weeks;
}

/** 期間内の全incidents件数（総チケット数の定義。上記ヘッダコメント参照） */
export function countTotalIncidentsInPeriod(
  incidents: IncidentBurndownInput[],
  periodStart: string,
  periodEnd: string,
): number {
  const startMs = toEpochMs(periodStart);
  const endMs = toEpochMs(periodEnd);
  return incidents.filter((i) => {
    const ms = toEpochMs(i.detectedAt);
    return ms >= startMs && ms < endMs;
  }).length;
}

/** 期間終端時点で未解決の件数。periodEnd省略時は現在未解決件数を返す。 */
export function countRemainingIncidents(incidents: IncidentBurndownInput[], periodEnd?: string): number {
  if (!periodEnd) return incidents.filter((i) => i.resolvedAt === null).length;
  const endMs = toEpochMs(periodEnd);
  return incidents.filter(
    (i) => toEpochMs(i.detectedAt) < endMs && (i.resolvedAt === null || toEpochMs(i.resolvedAt) >= endMs),
  ).length;
}
