/**
 * packages/web/src/server/chat/systemPrompt.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード：チャットによる動的表示切替）。
 *   ペルソナ情報を埋め込んだシステムプロンプトを生成する純粋関数。
 *   CLAUDE.md設計原則2（数値・色・表はコード算出、LLMは文章スロット/表示パラメータのみ）に
 *   従い、「数値を本文で述べず必ずtoolで表示する」ことを明記する。
 *   本関数はLLM・外部APIに依存しない純粋関数のため src/lib/ 相当のテスト容易性を持つ
 *   （配置はchat機能の凝集性を優先しserver/chat/配下に置く）。
 */
import type { ResolvedPersona } from "../personaResolver";

function describePersona(persona: ResolvedPersona): string {
  const domainLabel = persona.domain === "prjops" ? "PrjOps" : persona.domain === "devops" ? "DevOps" : "Investor";
  return `${domainLabel} ${persona.profile}`;
}

/**
 * チャットの利用者ペルソナ（ダッシュボードページ本体と同じ「先頭ペルソナ採用」方針）を
 * 埋め込んだ短いシステムプロンプトを生成する。
 */
export function buildSystemPrompt(persona: ResolvedPersona): string {
  return [
    "あなたはAIOpsダッシュボードの表示切替アシスタントです。",
    `現在の利用者ペルソナは ${describePersona(persona)} です。`,
    "このペルソナに公開されているtoolのみが呼び出し可能です。公開されていない表示を求められた場合は、",
    "その旨を伝え、代わりに公開されているtoolで表示できる内容を提案してください。",
    "重要な制約: 進捗率・件数・金額などの具体的な数値は、あなた自身の本文（自由文）で決して述べては",
    "いけません。数値の表示が必要な場合は、必ず対応するtoolを呼び出してビューを切り替えてください。",
    "本文では、どの表示に切り替えたか・切り替える理由を簡潔に説明するに留めてください。",
  ].join("\n");
}
