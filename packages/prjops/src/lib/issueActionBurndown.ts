/**
 * packages/prjops/src/lib/issueActionBurndown.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。マネージャー層（PRF-03）ダッシュボードの主指標
 *   「バーンダウンチャート」をPrjOps側（Issue/Action相当のエンティティ）で算出する純粋関数。
 *   packages/devops/src/lib/incidentBurndown.ts と同一の週次バケット集計方式を採用する
 *   （両ドメインでダッシュボード表示ロジックを揃えるため）。
 *
 * チケットの定義（本タスクでの解釈）: 本リポジトリには prjops-data 外部リポジトリのIssue/Action
 *   実データが存在しないため、Web側は PrjopsReportDataProvider インターフェース越しに
 *   Issue/Action相当のレコード（createdAt/closedAt）を取得する前提とする。本モジュールはその
 *   取得結果（配列）を受け取って集計するのみで、データ取得方法には関知しない（残課題:
 *   本番実装は prjops-data 連携タスクで別途行う）。
 *
 * 総チケット数=期間内に作成された件数、残チケット数=closedAt が null の件数、として扱う
 * （devops側の「総件数=期間内検知件数」「残件数=未解決件数」という定義と対応させる）。
 */

export interface IssueActionBurndownInput {
  createdAt: string; // ISO 8601
  closedAt: string | null; // ISO 8601 または未完了ならnull
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
 * Issue/Action相当のレコード配列を週次バケットに集計し、累積オープン件数の推移（バーンダウン）を返す。
 * periodEndがperiodStart以前、または不正な期間の場合は空配列を返す。
 */
export function computeIssueActionBurndown(
  items: IssueActionBurndownInput[],
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

  for (const item of items) {
    const createdMs = toEpochMs(item.createdAt);
    const closedMs = item.closedAt === null ? null : toEpochMs(item.closedAt);
    if (createdMs < startMs && (closedMs === null || closedMs >= startMs)) openingBacklog += 1;
    const openedIdx = bucketIndex(item.createdAt, startMs, weekMs, weekCount);
    if (openedIdx !== null) openedCounts[openedIdx] = openedCounts[openedIdx]! + 1;

    const resolvedIdx = bucketIndex(item.closedAt, startMs, weekMs, weekCount);
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
      remaining: Math.max(0, cumulativeOpened - cumulativeResolved),
    });
  }
  return weeks;
}

/** 期間内に作成された件数（総チケット数の定義。上記ヘッダコメント参照） */
export function countTotalItemsInPeriod(
  items: IssueActionBurndownInput[],
  periodStart: string,
  periodEnd: string,
): number {
  const startMs = toEpochMs(periodStart);
  const endMs = toEpochMs(periodEnd);
  return items.filter((i) => {
    const ms = toEpochMs(i.createdAt);
    return ms >= startMs && ms < endMs;
  }).length;
}

/** 期間終端時点で未完了の件数。periodEnd省略時は現在未完了件数を返す。 */
export function countRemainingItems(items: IssueActionBurndownInput[], periodEnd?: string): number {
  if (!periodEnd) return items.filter((i) => i.closedAt === null).length;
  const endMs = toEpochMs(periodEnd);
  return items.filter((i) => toEpochMs(i.createdAt) < endMs && (i.closedAt === null || toEpochMs(i.closedAt) >= endMs))
    .length;
}
