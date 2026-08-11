# T18: Seven Keys 月次 PDCA スナップショットの永続化とジョブ結線(T15 の 2-2 フォローアップ)

## Objective

T15 で documented-scope-out とした監査 2-2 を解消する。ADR-0010 の決定「月次 PDCA サイクルを報告ジョブに組み込み、前月 RAG、当月 RAG、主要変化、次アクションを記録する」を、既存の純粋関数 `buildSevenKeysMonthlySnapshot` を本番経路に結線して実現する。

## スコープ

1. **永続化**: `packages/devops/src/db/schema.sql` に `seven_keys_snapshots` テーブル(CREATE TABLE IF NOT EXISTS: 年月、project_id、キー毎 RAG の JSON、生成時刻。追記専用の流儀)+ 対応リポジトリ層 `packages/server/src/db/sevenKeysSnapshotsRepo.ts` + テスト(schema 変更規約: 同一 PR)
2. **月次ジョブ**: server の scheduler に月次スナップショットタスクを追加(既存 scheduler/tasks の流儀、営業日カレンダー(shared/businessCalendar)で月初営業日に実行、reentrancy/冪等 — 同月再実行はスキップし監査ログ)。executive summary の入力(prjopsReportData の provider)から `buildSevenKeysMonthlySnapshot` で前月比差分を算出して保存
3. **表示**: ExecutiveSevenKeysView(または executive-summary ハンドラ)に前月比(改善/悪化キー)を表示する最小の結線。デザインは T11 のトークン/流儀に従う
4. **ADR-0010 と VERIFICATION_REPORT の requires-follow-up 記載を「実装済み」に更新**
5. 仕様 ID: AC-038-1 の月次差分部分を検証するテストを拡充(describe/it に ID)

## ブランチ

- `agent/T18` を `agent/T16` から作成、PR base は `agent/T16`(スタック継続、PR 説明に明記)

## 規約 / Forbidden

- DoD: 並列 `mise run ci` green。依存追加なし、実 API 呼び出しなし(テストはモック)、audit_log/スナップショットへの UPDATE/DELETE なし、マージ禁止、`.orchestration/` は commit しない

## Expected artifacts(絶対パス)

- report: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/reports/T18-report.md`
- validation: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/validation/T18-validation.txt`
- sandbox / learning / autoskill: 同ディレクトリ T18-\*.md

## Done signal

```sh
~/.agents/skills/agmsg/scripts/send.sh ai-ops-platform codex-gpt55-high orchestrator-fable5 'AGMSG-RESULT v1 task_id=T18 status=ready_for_review report=... validation=... sandbox=... learning=... autoskill=...'
```

max_turns: 40
