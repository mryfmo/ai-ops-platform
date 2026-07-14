/**
 * packages/shared/src/language.ts
 *
 * 根拠:
 *   - PrjOps:ASM-002: 報告言語は受信者ごとにja/enを選択可能。既定値は国内企業=ja、海外企業=en。
 *   - PrjOps DOC-05 §8: stakeholder.preferred_language未設定時は organization.country が JP なら ja、他は en。
 *   - DevOps:SPEC-INT-064: 外部向け通知はja/en両言語のテンプレートを保持し、partner_companies.languageで選択。
 *     機械翻訳の動的生成は行わない（文言の法的・契約的な揺れを防ぐため）— 本モジュールも動的翻訳は提供しない。
 */

export type Lang = "ja" | "en";

export interface LanguageResolutionInput {
  preferredLanguage?: Lang | null;
  organizationCountry?: string | null; // ISO 3166-1 alpha-2, e.g. "JP"
}

/** stakeholder/partner_companyの言語を決定する（ASM-002 / DOC-05 §8の優先順位を純粋関数化） */
export function resolveLanguage(input: LanguageResolutionInput): Lang {
  if (input.preferredLanguage === "ja" || input.preferredLanguage === "en") {
    return input.preferredLanguage;
  }
  return input.organizationCountry === "JP" ? "ja" : "en";
}

/** 定型文言テンプレート集。動的機械翻訳は行わない（DevOps:SPEC-INT-064）。 */
export interface BilingualText {
  ja: string;
  en: string;
}

export function pick(text: BilingualText, lang: Lang): string {
  return lang === "ja" ? text.ja : text.en;
}
