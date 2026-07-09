/**
 * packages/shared/src/html/htmlSanitizeCheck.ts
 *
 * 根拠:
 *   - PrjOps SPEC-INT-051 (c): プレースホルダ（{{ }} / undefined / null の出現ゼロ検査）。
 *   - PrjOps SPEC-INT-051 (a): レポートHTML内の data-src="{path}#{field}" 属性付き数値を全抽出し、
 *     正本YAMLの値と完全一致比較。
 *   - PrjOps REQ-010 AC-010-2: 1ファイルのサイズは2MB以下。
 *   - DevOps REQ-020 AC-020b: レポート内の数値がソースデータと一致する。
 */

const PLACEHOLDER_PATTERNS = [/\{\{/, /\}\}/, /\bundefined\b/, /\bnull\b/];

export interface PlaceholderCheckResult {
  ok: boolean;
  matches: string[];
}

/** SPEC-INT-051(c) プレースホルダ検査 */
export function checkNoPlaceholders(html: string): PlaceholderCheckResult {
  const matches: string[] = [];
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(html)) matches.push(pattern.source);
  }
  return { ok: matches.length === 0, matches };
}

/** REQ-010 AC-010-2 / SPEC-EXT-020: 自己完結HTML 2MB以下 */
export function checkFileSizeWithinLimit(html: string, limitBytes: number = 2 * 1024 * 1024): boolean {
  return Buffer.byteLength(html, "utf8") <= limitBytes;
}

/** 外部CSS/JS参照がないことの検査（REQ-010 AC-010-1 自己完結HTML） */
export function checkNoExternalReferences(html: string): { ok: boolean; offenders: string[] } {
  const offenders: string[] = [];
  const linkTagRe = /<link[^>]+href=["']https?:\/\//gi;
  const scriptSrcRe = /<script[^>]+src=["']https?:\/\//gi;
  const imgExternalRe = /<img[^>]+src=["']https?:\/\//gi;
  for (const [name, re] of [
    ["external <link>", linkTagRe],
    ["external <script src>", scriptSrcRe],
    ["external <img src>", imgExternalRe],
  ] as const) {
    if (re.test(html)) offenders.push(name);
  }
  return { ok: offenders.length === 0, offenders };
}

export interface DataSrcRef {
  path: string; // 正本データ内のパス（例: "projects/PJ-001"）
  field: string; // フィールド名（例: "progress_pct"）
  displayedValue: string; // HTML中に表示されている値（文字列比較用に正規化前）
}

/**
 * `data-src="{path}#{field}"` 属性付きの数値要素を全抽出する（SPEC-INT-051 (a)）。
 * 例: <span data-src="status_updates/SU-PJ-001-2026-W27-1#progress_pct">62</span>
 */
export function extractDataSrcRefs(html: string): DataSrcRef[] {
  const refs: DataSrcRef[] = [];
  const re = /data-src="([^"#]+)#([^"]+)"[^>]*>([^<]*)</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    refs.push({ path: m[1]!, field: m[2]!, displayedValue: (m[3] ?? "").trim() });
  }
  return refs;
}

export interface NumericMismatch {
  path: string;
  field: string;
  displayed: string;
  expected: string;
}

/**
 * data-src参照値と正本データ（呼び出し側が提供するlookup関数）を突合する（SPEC-INT-051 (a)）。
 * lookup(path, field) は正本データからの期待値を文字列で返す（数値は文字列化して比較することで
 * 表示フォーマット差異（末尾ゼロ等）を吸収しすぎないよう、呼び出し側で正規化を統一する）。
 */
export function verifyNumericConsistency(
  html: string,
  lookup: (path: string, field: string) => string | undefined,
): { ok: boolean; mismatches: NumericMismatch[]; checkedCount: number } {
  const refs = extractDataSrcRefs(html);
  const mismatches: NumericMismatch[] = [];
  for (const ref of refs) {
    const expected = lookup(ref.path, ref.field);
    if (expected === undefined || expected !== ref.displayedValue) {
      mismatches.push({
        path: ref.path,
        field: ref.field,
        displayed: ref.displayedValue,
        expected: expected ?? "(not found)",
      });
    }
  }
  return { ok: mismatches.length === 0, mismatches, checkedCount: refs.length };
}

/**
 * プロファイル別の禁止語彙・禁止フィールド検査（SPEC-INT-051 (b)）。
 * 例: PRF-04(経営陣)は個人名、PRF-05(投資元)は氏名＋issue.detail＋社内固有語リストを禁止。
 */
export function checkForbiddenTerms(html: string, forbiddenTerms: string[]): { ok: boolean; found: string[] } {
  const found = forbiddenTerms.filter((term) => term.length > 0 && html.includes(term));
  return { ok: found.length === 0, found };
}
