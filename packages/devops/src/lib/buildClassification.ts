/**
 * packages/devops/src/lib/buildClassification.ts
 *
 * 根拠: SPEC-INT-011 手順6 / DevOps:REQ-001 AC-001c
 *   confidence < 0.6 の場合は classification を unknown に上書きする
 *   （過信した誤分類より不明を優先する）。LLM出力に対する決定的な後処理。
 */

export type BuildFailureClassification = "test_failure" | "compile_error" | "dependency" | "infra_timeout" | "unknown";

export interface ClassificationResult {
  classification: BuildFailureClassification;
  failed_job: string;
  failed_step: string;
  log_excerpt: string;
  confidence: number;
}

/** SPEC-INT-011手順6: confidence<0.6ならunknownへ強制する純関数 */
export function applyConfidenceGuard(result: ClassificationResult): ClassificationResult {
  if (result.confidence < 0.6 && result.classification !== "unknown") {
    return { ...result, classification: "unknown" };
  }
  return result;
}
