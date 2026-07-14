/**
 * packages/prjops/src/lib/severityProposal.ts
 *
 * 根拠: REQ-008 課題・リスクの重要度スコアリング
 *   - 報告者の申告を初期値とし、AGT-03は「影響の記述にコスト・納期・法令のいずれかが含まれ、
 *     かつ対象が複数企業に及ぶ」場合に「高」への引き上げを提案できる（自動確定はしない。確定はPRF-02）。
 *   - AC-008-1: 引き上げ提案は理由文とともにPRF-02へTeams通知される。
 *   - AC-008-2: PRF-02が72時間応答しない場合、提案値が仮適用され、レポートに「仮」ラベルが付く。
 *
 * 設計方針: トリガー判定（キーワード照合＋対象企業数）は決定的なコード判定とし、LLMには理由文の
 * 「文章化」のみを行わせる（判定そのものをLLMに委ねない。DOC-05 PrjOps:SPEC-INT-001の設計原則を踏襲）。
 */

export type Severity = "high" | "medium" | "low";

// 「コスト・納期・法令」に相当する語（日本語・英語の代表的表記）。将来的な拡張はこの配列のみ変更すればよい。
const COST_SCHEDULE_LEGAL_KEYWORDS: RegExp[] = [
  /コスト/,
  /費用/,
  /予算超過/,
  /cost/i,
  /budget/i,
  /納期/,
  /遅延/,
  /schedule/i,
  /deadline/i,
  /delay/i,
  /法令/,
  /契約/,
  /コンプライアンス/,
  /legal/i,
  /compliance/i,
  /contract/i,
];

export interface EscalationTriggerInput {
  currentSeverity: Severity;
  impactDescription: string; // 課題・リスクの「影響」記述
  affectedOrganizationIds: string[]; // 対象が及ぶ企業ID一覧
}

export interface EscalationTriggerResult {
  shouldPropose: boolean;
  matchedKeywords: string[];
  affectsMultipleOrganizations: boolean;
}

/** REQ-008 トリガー判定: 影響記述にコスト/納期/法令キーワードが含まれ、かつ複数企業に影響する場合のみ提案可能 */
export function evaluateEscalationTrigger(input: EscalationTriggerInput): EscalationTriggerResult {
  const matchedKeywords = COST_SCHEDULE_LEGAL_KEYWORDS.filter((re) => re.test(input.impactDescription)).map(
    (re) => re.source,
  );
  const affectsMultipleOrganizations = new Set(input.affectedOrganizationIds).size >= 2;
  const alreadyHigh = input.currentSeverity === "high";
  const shouldPropose = !alreadyHigh && matchedKeywords.length > 0 && affectsMultipleOrganizations;
  return { shouldPropose, matchedKeywords, affectsMultipleOrganizations };
}

const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;

export interface SeverityProposalState {
  value: Severity;
  reason: string;
  proposedAt: string; // ISO 8601
}

/** AC-008-2: PRF-02が72時間応答しない場合、提案値が仮適用される。毎日判定するジョブから呼ばれる純粋関数。 */
export function shouldAutoApplyProposal(proposal: SeverityProposalState, now: Date): boolean {
  const proposedAtMs = Date.parse(proposal.proposedAt);
  return now.getTime() - proposedAtMs >= SEVENTY_TWO_HOURS_MS;
}

/** レポート表示用: 仮適用された重要度には「仮」ラベルを付与する（AC-008-2） */
export function formatSeverityForDisplay(severity: Severity, isProvisional: boolean, lang: "ja" | "en"): string {
  const labels: Record<Severity, { ja: string; en: string }> = {
    high: { ja: "高", en: "High" },
    medium: { ja: "中", en: "Medium" },
    low: { ja: "低", en: "Low" },
  };
  const base = labels[severity][lang];
  if (!isProvisional) return base;
  return lang === "ja" ? `${base}（仮）` : `${base} (provisional)`;
}
