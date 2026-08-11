# T15: 整合監査の是正 + スタック統合(ADR 群・Excel の取り込み)

## Objective

`.orchestration/audit/2026-07-09-consistency-audit.md`(**必読**)の発見事項をすべて是正し、仕様 ⇔ 実装 ⇔ テスト ⇔ 実行証跡の整合をとる。あわせて構造的ブロッカー B-1(ADR-0007〜0012 と Excel 実装がスタック外)を解消する。

**注意: 監査 1(時系列/Excel 系)の追補が作業中に届く。オーケストレーターから「追補あり」の連絡が来たら audit ファイルを再読し、追補分も同一ブランチで是正すること。**

## 手順

### 1. 統合ブランチ作成(B-1 解消)

- `agent/T15` を `agent/T13` から作成
- `origin/agent/T06`(ADR-0007〜0012 + docs/research)を merge。競合(spec-ids 等)は双方の意図を保存して解決
- `origin/agent/T08`(Excel インポート)を merge。競合(schema.sql、shared/index.ts、spec-ids、pnpm-lock — lock は `pnpm install` で再生成)を解決
- merge 後、`mise run ci`(並列)green を確認してから是正に着手

### 2. HIGH の是正

- **3-1**: report-generation.yml の経路を再設計 — metrics はコード算出で注入し、LLM 生成はスロットのみに限定(reportPrompt/reportGenerator を CI 経路に組み込む。スキーマを「スロットのみ」用に分離するか、生成前に metrics を計算するステップを追加)。3-2(retry/truncate/監査の CI 経路組込)も同時に解決すること
- **2-1**: Seven Keys 質問票の入力経路を実装(最小で可: 質問票の保存先(既存 DB 流儀のテーブルか設定ファイルか、リポジトリの既存パターンに最適な方を選び report で理由を述べる)+ buildExecutiveSummary への配線 + 入力 UI/API は最小限)。工数が過大と判断する場合は、ADR-0010 に「質問票入力は後続フェーズ、現状は grey 表示が正しい挙動」と明記し VERIFICATION_REPORT にも requires-follow-up として記録する(どちらを選んだか report に明記)
- ADR の宙吊り参照は手順 1 の統合で解消されるが、ADR-0009/0012 に監査で判明した実態との差(3-1 是正後の経路、Recharts 採用が spec-change issue #2 承認待ちである状態)を追記して整合させる

### 3. MED/LOW の是正(audit ファイルの全項目)

- 2-2: 月次 PDCA スナップショットの配線(または明示スコープアウト — 選択理由を report に)
- 2-3: RAG 閾値に出典/較正ノブのコメント + ADR-0010 追記
- 2-4: investorMetrics の version を string 化、値解決を定義テーブル駆動に
- 2-5/2-7/2-10/3-4/3-5: テスト追補(investor 403 負テスト、K6 grey、形状/ラベル冗長表示、E-RPT03、it タイトルへの仕様 ID)
- 2-6: InvestorReportView に tabular 適用
- 2-8: AGENTS.md の参照ドキュメント一覧を ADR-0013 まで更新
- 2-9: 旧 5 指標の残骸(コメント・dead mapping)除去
- 3-3: 根拠 ID ヘッダ 5 ファイルに追加 + verifyTraceability に「新規 src ファイルのヘッダ検査」を追加(規約 3 の文言どおりに強制する)
- 3-6: クライアント PageAgentContext から dead な persona フィールド削除

## 規約

- DoD: 並列 `mise run ci` green。是正ごとに audit ファイルの番号を commit メッセージまたは PR 本文で参照
- PR は base `agent/T13`(`ai-generated`)。マージ禁止。`.orchestration/` は commit しない(audit ファイルも commit しない)
- 依存追加なし(T08 merge で exceljs が入るのは既承認分)

## Forbidden actions

- 発見事項の黙殺・先送り(スコープアウトする場合は必ず文書化と report 記載)
- main への push、PR マージ、force push、実 API 呼び出し

## Expected artifacts(絶対パス)

- report: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/reports/T15-report.md` — 発見番号ごとの対応表(fixed / documented-scope-out + 理由)
- validation: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/validation/T15-validation.txt`
- sandbox / learning / autoskill: 同ディレクトリ T15-\*.md

## Done signal

```sh
~/.agents/skills/agmsg/scripts/send.sh ai-ops-platform codex-gpt55-high orchestrator-fable5 'AGMSG-RESULT v1 task_id=T15 status=ready_for_review report=... validation=... sandbox=... learning=... autoskill=...'
```

max_turns: 80
