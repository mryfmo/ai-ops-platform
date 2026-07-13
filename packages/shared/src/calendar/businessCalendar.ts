/**
 * packages/shared/src/calendar/businessCalendar.ts
 *
 * 根拠:
 *   - PrjOps SPEC-INT-054（営業日カレンダー。「第n営業日」判定の唯一の根拠）
 *   - PrjOps DOC-02 §2（月次=毎月第1営業日、四半期=四半期初月第3営業日）
 *   - DevOps SPEC-INT-033（AGT-RPTの営業日判定）、SPEC-INT-021 factor E（営業時間外判定）
 *
 * 設計方針:
 *   - すべて純粋関数。祝日データ（HolidayCalendar）を明示的に注入することで、
 *     同一入力に対し常に同一出力を返す決定的な実装とする
 *     （PrjOps REQ-007 AC-007-1 および DevOps REQ-011 AC-011a と同じ設計原則を踏襲）。
 *   - 日付は "YYYY-MM-DD" のJSTカレンダー日として扱う。ホストのタイムゾーンに依存しないよう、
 *     日付演算はすべて Date.UTC を「タイムゾーン中立な日数カウンタ」として使う。
 */
import { parse as parseYaml } from "yaml";
import { toJstClock } from "../jst.js";

export interface HolidayEntry {
  date: string; // YYYY-MM-DD (JST)
  name_ja: string;
  verified: boolean;
}

export interface HolidayCalendar {
  holidays: ReadonlySet<string>;
  entries: readonly HolidayEntry[];
}

/** YAML文字列（jp_holidays.yaml形式）からカレンダーを構築する。YAMLパーサはホスト側(shared/src/index.ts)で注入する。 */
export function buildHolidayCalendar(entries: HolidayEntry[]): HolidayCalendar {
  return {
    holidays: new Set(entries.map((e) => e.date)),
    entries: [...entries],
  };
}

export function buildHolidayCalendarFromYaml(yamlText: string): HolidayCalendar {
  const parsed = parseYaml(yamlText) as { holidays?: HolidayEntry[] };
  return buildHolidayCalendar(parsed.holidays ?? []);
}

function assertValidDateStr(dateStr: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`E-CAL01: invalid date string "${dateStr}" (expected YYYY-MM-DD)`);
  }
}

/** "YYYY-MM-DD" -> タイムゾーン中立な日数エポック（UTC midnight基準の整数日数） */
function toEpochDay(dateStr: string): number {
  assertValidDateStr(dateStr);
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!) / 86400000;
}

function fromEpochDay(epochDay: number): string {
  const ms = epochDay * 86400000;
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 0=日曜 ... 6=土曜 */
export function dayOfWeek(dateStr: string): number {
  const epochDay = toEpochDay(dateStr);
  // 1970-01-01 (epochDay=0) was a Thursday (4)
  return ((epochDay % 7) + 7 + 4) % 7;
}

export function isWeekend(dateStr: string): boolean {
  const dow = dayOfWeek(dateStr);
  return dow === 0 || dow === 6;
}

export function isJpHoliday(cal: HolidayCalendar, dateStr: string): boolean {
  assertValidDateStr(dateStr);
  return cal.holidays.has(dateStr);
}

/** 営業日 = 土日でなく、かつ祝日カレンダーに存在しない日（SPEC-INT-054） */
export function isBusinessDay(cal: HolidayCalendar, dateStr: string): boolean {
  return !isWeekend(dateStr) && !isJpHoliday(cal, dateStr);
}

/** dateStr以降（dateStr自身を含む）で最初の営業日を返す */
export function nextBusinessDayOnOrAfter(cal: HolidayCalendar, dateStr: string): string {
  let epochDay = toEpochDay(dateStr);
  // ガード: 無限ループ防止のため最大3650日（約10年）で打ち切る
  for (let i = 0; i < 3650; i++) {
    const candidate = fromEpochDay(epochDay);
    if (isBusinessDay(cal, candidate)) return candidate;
    epochDay += 1;
  }
  throw new Error("E-CAL02: no business day found within search horizon");
}

/**
 * dateStrを起点として、n営業日後（nが負の場合はn営業日前）の日付を返す。
 * n=0 の場合、dateStr自身が営業日ならそれを返し、営業日でなければ次の営業日を返す
 * （REQ-009のアクション督促間隔「超過当日/+2営業日/+5営業日」の基準計算に使用）。
 */
export function addBusinessDays(cal: HolidayCalendar, dateStr: string, n: number): string {
  let epochDay = toEpochDay(dateStr);
  if (n === 0) {
    return nextBusinessDayOnOrAfter(cal, dateStr);
  }
  const step = n > 0 ? 1 : -1;
  let remaining = Math.abs(n);
  // 起点自体が営業日でなくても、そこから走査を開始する
  while (remaining > 0) {
    epochDay += step;
    const candidate = fromEpochDay(epochDay);
    if (isBusinessDay(cal, candidate)) {
      remaining -= 1;
    }
  }
  return fromEpochDay(epochDay);
}

/**
 * year-month の 第n営業日 を返す（PrjOps DOC-02: 月次配信=第1営業日 / 四半期=初月第3営業日、
 * DevOps SPEC-INT-033: 月次棚卸し=第1営業日 REQ-019）。
 * month は 1-12。
 */
export function nthBusinessDayOfMonth(cal: HolidayCalendar, year: number, month: number, n: number): string {
  if (n < 1) throw new Error("E-CAL03: n must be >= 1");
  const mm = String(month).padStart(2, "0");
  let epochDay = toEpochDay(`${year}-${mm}-01`);
  let count = 0;
  for (let i = 0; i < 62; i++) {
    // 月をまたいで31日+αあれば十分
    const candidate = fromEpochDay(epochDay);
    if (!candidate.startsWith(`${year}-${mm}`)) break;
    if (isBusinessDay(cal, candidate)) {
      count += 1;
      if (count === n) return candidate;
    }
    epochDay += 1;
  }
  throw new Error(`E-CAL04: month ${year}-${mm} does not have ${n} business days`);
}

/** dateStrが year-month の 第n営業日 に一致するかどうか（スケジューラの日次判定ジョブが使用） */
export function isNthBusinessDayOfMonth(cal: HolidayCalendar, dateStr: string, n: number): boolean {
  assertValidDateStr(dateStr);
  const [y, m] = dateStr.split("-").map(Number);
  return nthBusinessDayOfMonth(cal, y!, m!, n) === dateStr;
}

/** dateStrが「四半期初月」（1,4,7,10月）であるかどうか */
export function isQuarterStartMonth(dateStr: string): boolean {
  assertValidDateStr(dateStr);
  const month = Number(dateStr.split("-")[1]);
  return month === 1 || month === 4 || month === 7 || month === 10;
}

/**
 * JSTの営業時間内かどうかを判定する（DevOps SPEC-INT-021 factor E）。
 * 定義: 営業時間外 = 平日19:00〜翌9:00、または土日・祝日終日。
 * @param dateStr YYYY-MM-DD (JST calendar date)
 * @param hhmm "HH:mm" (JST, 24時間表記)
 */
export function isBusinessHoursJst(cal: HolidayCalendar, dateStr: string, hhmm: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) throw new Error(`E-CAL05: invalid time "${hhmm}"`);
  if (!isBusinessDay(cal, dateStr)) return false;
  const [hh, mm] = hhmm.split(":").map(Number);
  const minutes = hh! * 60 + mm!;
  const start = 9 * 60; // 09:00
  const end = 19 * 60; // 19:00
  return minutes >= start && minutes < end;
}

/** 2つの日付（YYYY-MM-DD）の間の営業日数（超過日数計算などに使用。end - start、両端の扱いはexclusive-start） */
export function businessDaysBetween(cal: HolidayCalendar, startExclusive: string, endInclusive: string): number {
  let s = toEpochDay(startExclusive);
  const e = toEpochDay(endInclusive);
  if (s >= e) return 0;
  let count = 0;
  while (s < e) {
    s += 1;
    const candidate = fromEpochDay(s);
    if (isBusinessDay(cal, candidate)) count += 1;
  }
  return count;
}

export function todayJstDateString(now: Date = new Date()): string {
  const jst = toJstClock(now);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function nowJstHHmm(now: Date = new Date()): string {
  const jst = toJstClock(now);
  const h = String(jst.getUTCHours()).padStart(2, "0");
  const mi = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${h}:${mi}`;
}
