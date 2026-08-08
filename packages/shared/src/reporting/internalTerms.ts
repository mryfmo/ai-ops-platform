/**
 * packages/shared/src/reporting/internalTerms.ts
 *
 * 根拠: PrjOps:SPEC-INT-051(b)。仕様で列挙された社内固有語の版管理済み正本。
 */

export const SPEC_INTERNAL_TERMS_VERSION = "PrjOps:SPEC-INT-051@2026-08-08";

// PrjOps:SPEC-INT-051 と関連仕様に具体的な語の列挙はない。内容の登録は運用判断 D-14 に委ねる。
export const SPEC_INTERNAL_TERMS: readonly string[] = Object.freeze([]);

export const SPEC_INTERNAL_TERMS_PROVIDER = Object.freeze({
  version: SPEC_INTERNAL_TERMS_VERSION,
  listInternalTerms: (): readonly string[] => SPEC_INTERNAL_TERMS,
});
