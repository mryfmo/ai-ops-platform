/**
 * packages/prjops/src/agents/AGT07_verifier.ts
 *
 * 根拠: REQ-019 配信前検証 / SPEC-INT-051
 *   AGT-07は配信前に次を機械検証する:
 *   (a) レポート内数値と正本データの一致
 *   (b) 閲覧権限違反の不在
 *   (c) プレースホルダ（未置換変数）の不在
 *   (d) 宛先とレポート対象者の一致
 *   AC-019-1: (a)〜(d)のいずれかがNGのレポートは配信されず、NG理由コード付きで運用担当へ通知される
 *   （SPEC-EXT-039 検証NG・障害通知）。
 *   SPEC-INT-061エラーコード: E-VER0A〜0D 検証NG(a〜d)
 */
import {
  checkNoPlaceholders,
  verifyNumericConsistency,
  checkForbiddenTerms,
  checkFileSizeWithinLimit,
  checkNoExternalReferences,
} from "@aiops/shared/html/htmlSanitizeCheck.js";

export type VerificationFailureCode = "V-A" | "V-B" | "V-C" | "V-D";

export interface VerifyReportInput {
  html: string;
  numericLookup: (path: string, field: string) => string | undefined;
  forbiddenTerms: string[]; // buildForbiddenTermsForProfile()の出力
  intendedRecipientEmail: string;
  actualToEmail: string;
}

export interface VerifyReportResult {
  ok: boolean;
  failureCodes: VerificationFailureCode[];
  details: string[];
}

/** REQ-019 / SPEC-INT-051: 配信前の4種の機械検証をすべて実行する */
export function verifyReportBeforeDelivery(input: VerifyReportInput): VerifyReportResult {
  const failureCodes: VerificationFailureCode[] = [];
  const details: string[] = [];

  // (a) 数値一致
  const numeric = verifyNumericConsistency(input.html, input.numericLookup);
  if (!numeric.ok) {
    failureCodes.push("V-A");
    details.push(`数値不一致: ${JSON.stringify(numeric.mismatches)}`);
  }

  // (b) 権限（禁止語彙）
  const forbidden = checkForbiddenTerms(input.html, input.forbiddenTerms);
  if (!forbidden.ok) {
    failureCodes.push("V-B");
    details.push(`権限違反語彙検出: ${forbidden.found.join(", ")}`);
  }

  // (c) プレースホルダ
  const placeholder = checkNoPlaceholders(input.html);
  if (!placeholder.ok) {
    failureCodes.push("V-C");
    details.push(`未置換プレースホルダ検出: ${placeholder.matches.join(", ")}`);
  }

  // (d) 宛先一致
  if (input.intendedRecipientEmail.toLowerCase() !== input.actualToEmail.toLowerCase()) {
    failureCodes.push("V-D");
    details.push(`宛先不一致: intended=${input.intendedRecipientEmail}, actual=${input.actualToEmail}`);
  }

  // 付随チェック（REQ-010 AC-010-1/2。専用の失敗コードはないためV-Cに含める）
  if (!checkFileSizeWithinLimit(input.html)) {
    failureCodes.push("V-C");
    details.push("ファイルサイズが2MBを超過");
  }
  if (!checkNoExternalReferences(input.html).ok) {
    failureCodes.push("V-C");
    details.push("外部参照（CSS/JS/画像）を検出");
  }

  return { ok: failureCodes.length === 0, failureCodes: [...new Set(failureCodes)], details };
}
