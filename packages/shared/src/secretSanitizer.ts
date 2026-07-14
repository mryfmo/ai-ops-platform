/**
 * packages/shared/src/secretSanitizer.ts
 *
 * 根拠:
 *   - PrjOps:REQ-032（認証情報は暗号化シークレットストアのみで保持、コード・ログに平文で現れない）
 *   - DevOps:REQ-030 / DevOps:SPEC-INT-070（シークレットを平文でログ・レポート・PRコメントに出力しない。
 *     LLMへの入力からシークレットパターンを除去するサニタイザを全エージェント共通ライブラリとして実装）
 *
 * 使用箇所:
 *   - AGT-BLD: ビルドログをLLM分類プロンプトへ渡す前（PRコメントにログ抜粋を貼る前にも適用）
 *   - AGT-02/AGT-INC: 自由文報告・障害連絡をLLMへ渡す前
 *   - 監査ログ書き込み層（auditLog.ts）: 全レコードに対して最終防御として適用
 *
 * 設計方針: 既知のシークレット接頭辞・形式にマッチする文字列を検出しマスキングする決定的処理。
 * LLM自体に「隠して」と指示するだけでは DevOps:REQ-030/032 のACを満たせないため、
 * コードによる機械的除去を必須の層として置く。
 */

export interface SecretPattern {
  name: string;
  regex: RegExp;
}

// 既知の主要シークレット形式（GitHub / Anthropic / Microsoft / 汎用トークン）
export const SECRET_PATTERNS: SecretPattern[] = [
  { name: "private_key_block", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { name: "github_app_token", regex: /ghs_[A-Za-z0-9]{20,}/g },
  { name: "github_pat", regex: /gh[pousr]_[A-Za-z0-9]{20,}/g },
  { name: "anthropic_api_key", regex: /sk-ant-[A-Za-z0-9\-_]{20,}/g },
  { name: "authorization_header", regex: /Authorization:\s*Bearer\s+[A-Za-z0-9\-_.]+/gi },
  { name: "generic_bearer", regex: /Bearer\s+[A-Za-z0-9\-_.]{20,}/g },
  { name: "aws_access_key", regex: /AKIA[0-9A-Z]{16}/g },
  {
    name: "azure_client_secret_kv",
    regex: /(client_secret|clientSecret)["']?\s*[:=]\s*["']?[A-Za-z0-9\-_.~]{16,}["']?/gi,
  },
  { name: "generic_api_key_kv", regex: /(api[_-]?key|apikey)["']?\s*[:=]\s*["']?[A-Za-z0-9\-_.]{16,}["']?/gi },
  { name: "jwt", regex: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
];

export interface SanitizeResult {
  sanitized: string;
  redactionCount: number;
  matchedPatterns: string[];
  warnings: string[];
}

export interface SanitizeOptions {
  additionalPatterns?: readonly SecretPattern[];
  maskSuspiciousSequences?: boolean;
}

const SUSPICIOUS_SEQUENCE_PATTERNS: SecretPattern[] = [
  { name: "suspicious_hex", regex: /[A-Fa-f0-9]{32,}/g },
  { name: "suspicious_base64", regex: /[A-Za-z0-9+/]{32,}={0,2}/g },
];
const SUSPICIOUS_SEQUENCE_NAMES = new Set(SUSPICIOUS_SEQUENCE_PATTERNS.map(({ name }) => name));

interface NormalizedMatch {
  start: number;
  end: number;
  name: string;
  priority: number;
}

interface NormalizedShadow {
  text: string;
  originalStarts: number[];
  originalEnds: number[];
}

function buildNormalizedShadow(input: string): NormalizedShadow {
  const normalizedParts: string[] = [];
  const originalStarts: number[] = [];
  const originalEnds: number[] = [];
  let originalStart = 0;

  // 検出regexはNFKC後のASCII形式だけを対象とする。code point間のUnicode合成差はASCII secret形状を
  // 新たに作らないため、grapheme segmentationを避けて1-passのcode point mapを構築する。
  for (const character of input) {
    const normalized = character.normalize("NFKC");
    const originalEnd = originalStart + character.length;
    normalizedParts.push(normalized);
    for (let offset = 0; offset < normalized.length; offset += 1) {
      originalStarts.push(originalStart);
      originalEnds.push(originalEnd);
    }
    originalStart = originalEnd;
  }

  return { text: normalizedParts.join(""), originalStarts, originalEnds };
}

function mergeByStart(left: NormalizedMatch[], right: NormalizedMatch[]): NormalizedMatch[] {
  const merged: NormalizedMatch[] = [];
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length || rightIndex < right.length) {
    if (rightIndex >= right.length || (leftIndex < left.length && left[leftIndex]!.start <= right[rightIndex]!.start)) {
      merged.push(left[leftIndex++]!);
    } else {
      merged.push(right[rightIndex++]!);
    }
  }
  return merged;
}

function selectNonOverlappingMatches(candidates: NormalizedMatch[]): NormalizedMatch[] {
  candidates.sort((a, b) => a.priority - b.priority || a.start - b.start || b.end - a.end);
  let selected: NormalizedMatch[] = [];

  for (let groupStart = 0; groupStart < candidates.length;) {
    const priority = candidates[groupStart]!.priority;
    let groupEnd = groupStart;
    while (groupEnd < candidates.length && candidates[groupEnd]!.priority === priority) groupEnd += 1;

    const accepted: NormalizedMatch[] = [];
    let selectedIndex = 0;
    for (const candidate of candidates.slice(groupStart, groupEnd)) {
      while (selectedIndex < selected.length && selected[selectedIndex]!.end <= candidate.start) selectedIndex += 1;
      const occupied = selected[selectedIndex];
      if (!occupied || occupied.start >= candidate.end) accepted.push(candidate);
    }
    selected = mergeByStart(selected, accepted);
    groupStart = groupEnd;
  }

  return selected;
}

/** テキスト中の既知シークレットパターンを "***REDACTED:<pattern>***" に置換する。 */
export function sanitizeSecrets(input: string, options: SanitizeOptions = {}): SanitizeResult {
  const shadow = buildNormalizedShadow(input);
  const candidates: NormalizedMatch[] = [];
  const patterns = [
    ...SECRET_PATTERNS,
    ...(options.additionalPatterns ?? []),
    ...(options.maskSuspiciousSequences ? SUSPICIOUS_SEQUENCE_PATTERNS : []),
  ];

  for (const [priority, { name, regex }] of patterns.entries()) {
    regex.lastIndex = 0;
    for (let match = regex.exec(shadow.text); match; match = regex.exec(shadow.text)) {
      candidates.push({ start: match.index, end: match.index + match[0].length, name, priority });
    }
  }

  const matches = selectNonOverlappingMatches(candidates);
  if (matches.length === 0) return { sanitized: input, redactionCount: 0, matchedPatterns: [], warnings: [] };

  const mappedRedactions = matches.map((match) => ({
    range: [shadow.originalStarts[match.start]!, shadow.originalEnds[match.end - 1]!] as const,
    name: match.name,
  }));
  const redactions: typeof mappedRedactions = [];
  for (const redaction of mappedRedactions) {
    const previous = redactions[redactions.length - 1];
    if (!previous || redaction.range[0] >= previous.range[1]) redactions.push(redaction);
  }
  let sanitized = "";
  let cursor = 0;
  for (const {
    range: [start, end],
    name,
  } of redactions) {
    sanitized += `${input.slice(cursor, start)}***REDACTED:${name}***`;
    cursor = end;
  }
  sanitized += input.slice(cursor);

  const matchedNames = new Set(redactions.map(({ name }) => name));
  const matchedPatterns = patterns.filter(({ name }) => matchedNames.has(name)).map(({ name }) => name);
  const warnings = matchedPatterns.filter((name) => SUSPICIOUS_SEQUENCE_NAMES.has(name));
  return { sanitized, redactionCount: redactions.length, matchedPatterns, warnings };
}

/** LLMへ渡す前の入力に対する必須ゲート。REDACTしても検知件数を返すため、呼び出し側で監査ログに記録できる。 */
export function sanitizeForLlmInput(input: string, options: SanitizeOptions = {}): SanitizeResult {
  return sanitizeSecrets(input, options);
}

/** 出力（PRコメント・レポート・ログ）に対する最終防御チェック。true=クリーン。 */
export function isFreeOfKnownSecrets(text: string, options: SanitizeOptions = {}): boolean {
  return sanitizeSecrets(text, options).redactionCount === 0;
}
