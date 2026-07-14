/**
 * packages/prjops/src/lib/statusJudge.ts
 *
 * 根拠: REQ-007 ステータス自動判定 / PrjOps:SPEC-INT-032
 *
 * 判定基準（REQ-007から一字一句変更せず実装する）:
 *   - 危険(Red):  終了予定日超過、または 進捗率が計画線比▲15ポイント以上、または「危険」課題が1件以上
 *   - 注意(Yellow): 計画線比▲5〜▲15ポイント、または 期限超過アクションが3件以上
 *   - 順調(Green): 上記いずれにも該当しない
 *   計画線 = 経過期間÷全期間×100（開始日・終了予定日から算出）
 *
 * AC-007-1: 同一入力に対する判定結果は常に同一である（LLMの裁量を挟まない決定的計算）。
 *   → 本関数はLLM呼び出しを一切行わない純粋関数として実装する。
 * PrjOps:SPEC-INT-032: 単体テストで境界値（▲5.0 / ▲15.0ポイント、超過0日/1日）を固定する。
 *
 * 「危険」課題の定義: REQ-008の重要度(severity: high|medium|low)のうち high を「危険」課題として扱う
 * （PrjOps文書群には課題自体に"危険"というenum値は定義されておらず、REQ-007本文が参照する
 *   "「危険」課題"はREQ-008の重要度スキームにおける最上位区分 high を指すと解釈する。
 *   この解釈はDOC-05 SPEC-INT-024のseverity: high|medium|lowの定義と整合する）。
 */

export type StatusColor = "red" | "yellow" | "green";

function toEpochDay(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!) / 86400000;
}

/** 計画線(%) = 経過期間÷全期間×100。asOfDateがendDateを超えていれば100に、startDateより前なら0にクランプする。 */
export function computePlanLinePct(startDate: string, endDate: string, asOfDate: string): number {
  const start = toEpochDay(startDate);
  const end = toEpochDay(endDate);
  const asOf = toEpochDay(asOfDate);
  const totalDays = end - start;
  if (totalDays <= 0) {
    // 開始日=終了日、または不正な期間（終了日が開始日以前）。asOf到達で100%とみなす。
    return asOf >= start ? 100 : 0;
  }
  const elapsedDays = Math.min(Math.max(asOf - start, 0), totalDays);
  return (elapsedDays / totalDays) * 100;
}

export interface StatusJudgeInput {
  startDate: string;
  endDate: string;
  asOfDate: string;
  progressPct: number; // 0-100の整数（PrjOps:SPEC-INT-020 progress_pct）
  highSeverityOpenIssueCount: number; // REQ-008 severity=high かつ status=open の課題件数
  overdueActionCount: number; // 期限超過（status=open かつ due < asOfDate）のアクション件数
}

export interface StatusJudgeResult {
  color: StatusColor;
  planLinePct: number;
  gapPoints: number; // progressPct - planLinePct（負が遅延）
  isOverdue: boolean;
  reasons: string[]; // 適用された判定根拠（監査ログのbasisに使用）
}

/** REQ-007 / PrjOps:SPEC-INT-032: judge(project, latest_update, issues, actions) -> color 相当の純粋関数 */
export function judgeStatus(input: StatusJudgeInput): StatusJudgeResult {
  const planLinePct = computePlanLinePct(input.startDate, input.endDate, input.asOfDate);
  const gapPoints = input.progressPct - planLinePct;
  // 「終了予定日超過」の境界: asOfDateがendDateと同日はまだ超過していない（0日超過は非超過）。
  // asOfDateがendDateの翌日以降で初めて超過とみなす（超過0日/1日の境界値をPrjOps:SPEC-INT-032どおり固定）。
  const isOverdue = toEpochDay(input.asOfDate) > toEpochDay(input.endDate);

  const reasons: string[] = [];

  const redByOverdue = isOverdue;
  const redByGap = gapPoints <= -15; // ▲15ポイント以上 = 15点以上遅れ = gap <= -15
  const redByIssue = input.highSeverityOpenIssueCount >= 1;

  if (redByOverdue) reasons.push("REQ-007:終了予定日超過");
  if (redByGap) reasons.push(`REQ-007:計画線比${gapPoints.toFixed(1)}ポイント(▲15以上)`);
  if (redByIssue) reasons.push(`REQ-007:高重要度課題${input.highSeverityOpenIssueCount}件`);

  if (redByOverdue || redByGap || redByIssue) {
    return { color: "red", planLinePct, gapPoints, isOverdue, reasons };
  }

  const yellowByGap = gapPoints <= -5 && gapPoints > -15; // 計画線比▲5〜▲15ポイント
  const yellowByActions = input.overdueActionCount >= 3;

  if (yellowByGap) reasons.push(`REQ-007:計画線比${gapPoints.toFixed(1)}ポイント(▲5〜▲15)`);
  if (yellowByActions) reasons.push(`REQ-007:期限超過アクション${input.overdueActionCount}件`);

  if (yellowByGap || yellowByActions) {
    return { color: "yellow", planLinePct, gapPoints, isOverdue, reasons };
  }

  reasons.push("REQ-007:いずれの危険/注意条件にも非該当");
  return { color: "green", planLinePct, gapPoints, isOverdue, reasons };
}

/**
 * 自己申告色と機械判定色の乖離チェック（AC-007-2: 両方がレポートに併記される）。
 * @returns 乖離していればtrue
 */
export function selfReportDiffersFromJudged(selfStatus: StatusColor, judged: StatusColor): boolean {
  return selfStatus !== judged;
}
