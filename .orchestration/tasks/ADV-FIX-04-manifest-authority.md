# ADV-FIX-04: task manifest authority 基盤 + ガード結線(C-3 完結)

- 発注: claude-deep-dot(オーケストレータ)
- 根拠: `git show 4417cbd:.orchestration/audit/2026-08-18-adversarial-full-review.md` C-3 / F1 / F4、ADV-FIX-03 blocked 報告(`.orchestration/reports/ADV-FIX-03-REPORT.md`)の Minimum unblock design、受入記録 `.orchestration/acceptance/ADV-FIX-03-ACCEPTANCE.md` の設計裁定。
- ブランチ: `agent/ADV-FIX-04` を最新 `origin/main` から作成。PR base=main、`ai-generated` ラベル、draft 禁止、テンプレート記入、自動マージ禁止。

## Objective

coding task の manifest authority を production 経路に導入し(issuer→永続化→dispatch)、その上で path-boundary ガードと review collector digest 検証を結線する。ADV-FIX-03 の Minimum unblock design を、下記オーケストレータ裁定で確定した形で実装する。

## 確定済み設計裁定(逸脱時は blocked で相談)

1. **authority = exact UTF-8 bytes + raw-byte SHA-256**。canonical JSON 化はしない(path guard の raw-byte digest と一致)。
2. **永続化**: `coding_tasks` に `manifest`(TEXT NOT NULL)+ `manifest_sha256`(TEXT NOT NULL, hex64 CHECK)を migration(`NNN_description.sql` 新規、schema.sql は fresh 形のみ更新)で追加。task lifecycle 中の両列 UPDATE を audit_log と同型の BEFORE トリガで禁止。repo 層+テスト同一PR(AGENTS.md schema 変更手順に従う)。
3. **issuer**: task 起票時(server の coding task 作成経路)に、保守的な default path profile から manifest を生成する。default profile は `contracts/agent-task` の schema に適合し、`scripts/coding-agent-path-guard.mjs` の GOVERNANCE_SCOPES 相当を forbidden に含み、それ以外の repo パスを allowed とする(現行運用の挙動を狭めすぎない)。生成物は `validateAgentTaskManifest()` 検証後に bytes+digest を確定。instruction からの workflow 内合成は禁止。
4. **dispatch 束縛**: `packages/server/src/http/routes/codingTasks.ts` の workflow dispatch inputs に manifest digest(および manifest 供給手段)を追加。workflow 側は supplied bytes の SHA-256 が digest と一致することを検証してから使用。欠落/不一致は credential 発行・agent 実行前に fail-closed。inputs のサイズ制約で bytes を直接渡せない場合は、ledger からの取得+digest 照合など writer 非支配の供給方式を採り、方式を report に明記。
5. **coding workflow**: trusted step が manifest を `${RUNNER_TEMP}` に materialize→schema+digest 検証→job-local random HMAC key(add-mask)→ pre guard → agent 実行 → post guard 成功後のみ commit/push・GitHub credential 発行に進む順序。violation は台帳 callback の失敗系 status。
6. **review workflow**: `coding-task-review.yml` が dispatch authority 由来の digest を `scripts/collect-agent-review.mjs` の新入力 `manifestDigest` に渡す。mismatch/missing は critical machine finding + nonzero exit、artifact upload は `if: always()`。

## Allowed files

- packages/devops/src/db/schema.sql / packages/devops/src/db/migrations/**
- packages/server/src/db/codingTasksRepo.ts + packages/server/tests/**
- packages/server/src/http/routes/codingTasks.ts(+ 必要な server 内 issuer モジュール)
- packages/server/src/lib/** または packages/devops/src/lib/**(manifest 生成の純粋関数を置く場合)
- contracts/agent-task/**(既存 validator の利用に必要な範囲。schema 弱体化禁止)
- contracts/agent-review/workflow-validator.mjs / contracts/agent-review/agent-review.test.mjs(manifest_digest を required string input として追加する最小拡張のみ。既存チェックの緩和禁止 — 2026-08-18 スコープ修正承認)
- .github/workflows/coding-task.yml / .github/workflows/coding-task-review.yml
- .github/actions/run-coding-agent/**
- scripts/collect-agent-review.mjs + scripts/*.test.mjs + tests/**
- .orchestration/{reports,validation,sandboxes,learning,autoskill/runs}/ADV-FIX-04*
- .agents/worklog/codex/**

## Forbidden actions

- audit_log 変更; ガード・validator の弱体化; 依存追加; ruleset 適用; 新規長期秘密; draft PR; merge; force push; 上記以外の編集。

## Validation(exit code 単独記録・パイプで潰さない)

1. migration: 使い捨て PostgreSQL で fresh schema 適用と「fresh→migrate」両経路の一致確認、manifest 列 UPDATE がトリガで拒否されるテスト。
2. repo/route: 起票→manifest 生成→検証→永続化→dispatch inputs 束縛の end-to-end テスト(app.request)。digest 不一致・欠落の fail-closed テスト。
3. collector: 改竄 manifest / digest 欠落 / 一致の node --test。
4. `mise run actionlint` / `governance` / `lint` / `typecheck` / `traceability` / `format` / 対象パッケージ test。可能なら実PGで `mise run test:coverage` `verify:db`。
5. path guard のローカル pre/post 実行証跡(violation が fail する系を含む)。

## Expected artifacts

- report: .orchestration/reports/ADV-FIX-04-REPORT.md([memory:decision]、cost: 行、dispatch 供給方式の明記)
- validation: .orchestration/validation/ADV-FIX-04-validation.md
- sandbox: .orchestration/sandboxes/ADV-FIX-04-SANDBOX.md
- learning: .orchestration/learning/ADV-FIX-04-learning.md
- autoskill: .orchestration/autoskill/runs/ADV-FIX-04.md
- CompactionDB: 標準 waiver(consolidation は受入時オーケストレータ)。

## Done

`AGMSG-RESULT v1 task_id=ADV-FIX-04 status=ready_for_review|blocked ...`。max_turns=80。
