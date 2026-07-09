/**
 * packages/shared/src/secretSanitizer.ts
 *
 * 根拠:
 *   - PrjOps REQ-032（認証情報は暗号化シークレットストアのみで保持、コード・ログに平文で現れない）
 *   - DevOps REQ-030 / SPEC-INT-070（シークレットを平文でログ・レポート・PRコメントに出力しない。
 *     LLMへの入力からシークレットパターンを除去するサニタイザを全エージェント共通ライブラリとして実装）
 *
 * 使用箇所:
 *   - AGT-BLD: ビルドログをLLM分類プロンプトへ渡す前（PRコメントにログ抜粋を貼る前にも適用）
 *   - AGT-02/AGT-INC: 自由文報告・障害連絡をLLMへ渡す前
 *   - 監査ログ書き込み層（auditLog.ts）: 全レコードに対して最終防御として適用
 *
 * 設計方針: 既知のシークレット接頭辞・形式にマッチする文字列を検出しマスキングする決定的処理。
 * LLM自体に「隠して」と指示するだけでは REQ-030/032 のACを満たせないため、
 * コードによる機械的除去を必須の層として置く。
 */

interface SecretPattern {
  name: string;
  regex: RegExp;
}

// 既知の主要シークレット形式（GitHub / Anthropic / Microsoft / 汎用トークン）
export const SECRET_PATTERNS: SecretPattern[] = [
  { name: "github_pat", regex: /gh[pousr]_[A-Za-z0-9]{20,}/g },
  { name: "github_app_token", regex: /ghs_[A-Za-z0-9]{20,}/g },
  { name: "anthropic_api_key", regex: /sk-ant-[A-Za-z0-9\-_]{20,}/g },
  { name: "authorization_header", regex: /Authorization:\s*Bearer\s+[A-Za-z0-9\-_.]+/gi },
  { name: "generic_bearer", regex: /Bearer\s+[A-Za-z0-9\-_.]{20,}/g },
  { name: "aws_access_key", regex: /AKIA[0-9A-Z]{16}/g },
  { name: "azure_client_secret_kv", regex: /(client_secret|clientSecret)\s*[:=]\s*["']?[A-Za-z0-9\-_.~]{16,}["']?/gi },
  { name: "generic_api_key_kv", regex: /(api[_-]?key|apikey)\s*[:=]\s*["']?[A-Za-z0-9\-_.]{16,}["']?/gi },
  { name: "jwt", regex: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
  { name: "private_key_block", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
];

export interface SanitizeResult {
  sanitized: string;
  redactionCount: number;
  matchedPatterns: string[];
}

/** テキスト中の既知シークレットパターンを "***REDACTED:<pattern>***" に置換する。 */
export function sanitizeSecrets(input: string): SanitizeResult {
  let sanitized = input;
  let redactionCount = 0;
  const matchedPatterns = new Set<string>();

  for (const { name, regex } of SECRET_PATTERNS) {
    sanitized = sanitized.replace(regex, () => {
      redactionCount += 1;
      matchedPatterns.add(name);
      return `***REDACTED:${name}***`;
    });
  }

  return { sanitized, redactionCount, matchedPatterns: [...matchedPatterns] };
}

/** LLMへ渡す前の入力に対する必須ゲート。REDACTしても検知件数を返すため、呼び出し側で監査ログに記録できる。 */
export function sanitizeForLlmInput(input: string): SanitizeResult {
  return sanitizeSecrets(input);
}

/** 出力（PRコメント・レポート・ログ）に対する最終防御チェック。true=クリーン。 */
export function isFreeOfKnownSecrets(text: string): boolean {
  return SECRET_PATTERNS.every(({ regex }) => {
    regex.lastIndex = 0;
    return !regex.test(text);
  });
}
