# T05: packages/server の残存 TODO 2 件を解消する

## Objective

ADR-0005 の残課題としてコード中に TODO が残る 2 点を解消し、`mise run ci` green の状態で PR を作成する。

1. `packages/server/src/scheduler/tasks/eventsPollingTask.ts` — github/monitor 系イベントの dispatch 経路が未結線。events テーブルに enqueue された GitHub webhook イベントを適切なエージェント(devops の AGT_BLD/AGT_DEP/AGT_INC 等)へ振り分ける経路を、既存の dispatch パターンに倣って実装する。
2. `packages/server/src/index.ts` / `src/agents/teamsConversationAgent.ts` — stakeholder-master → authorAadId 解決が暫定固定値。stakeholder master(prjops のサンプル YAML / マスタ検証 lib を参照)から解決する実装に置き換える。マスタに該当がない場合のフォールバック(拒否 + 監査ログ)を含める。

まず両 TODO 周辺のコード・テスト・ADR-0005 を読み、設計意図に沿う最小実装を行うこと。設計判断が割れる場合は独断で大きく作らず、blocked として選択肢を報告してよい。

## Repo / 規約

- repo: `/Users/mryfmo/Workspace/ai-ops-platform`(mryfmo/ai-ops-platform の clone)
- AGENTS.md の規約に従う: lib/ 純粋関数と agents/ 結線層の分離、根拠 ID ヘッダ(新規ファイル時)、監査ログ追記専用、権限フィルタはデータ取得側
- 事前に `mise install` を実行(node@20 未導入の警告が出ている)
- DoD: `mise run ci` green。テスト追加必須(vitest、describe/it タイトルに仕様 ID)
- ブランチ `agent/T05` を main から作成、変更を Conventional Commits で commit、push して PR 作成(`gh pr create --repo mryfmo/ai-ops-platform --base main --head agent/T05`)、ラベル `ai-generated`(なければ作成)。**マージ禁止**
- `.orchestration/` は commit しない

## Forbidden actions

- main への直接 push、PR マージ、force push
- 依存関係の追加(既存依存のみで実装)
- TODO 2 件と無関係なリファクタリング
- LLM API 呼び出し(コード内の既存クライアント利用のテストはモックで)

## Expected artifacts(絶対パス)

- report: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/reports/T05-report.md` — 実装内容、PR URL、設計判断
- validation: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/validation/T05-validation.txt` — `mise run ci` の結果末尾、`git show --stat HEAD`、`gh pr view --json url,labels`
- sandbox: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/sandboxes/T05-sandbox.md`
- learning: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/learning/T05-learning.md`
- autoskill: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/autoskill/runs/T05-autoskill.md`

## Done signal

```sh
~/.agents/skills/agmsg/scripts/send.sh ai-ops-platform codex-gpt55-high orchestrator-fable5 'AGMSG-RESULT v1 task_id=T05 status=ready_for_review report=... validation=... sandbox=... learning=... autoskill=...'
```

max_turns: 25
