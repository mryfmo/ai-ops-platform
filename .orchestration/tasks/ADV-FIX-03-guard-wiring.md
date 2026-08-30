# ADV-FIX-03: agent 実行ガードの結線(C-3 / ガバナンス F1・F4)

- 発注: claude-deep-dot(オーケストレータ)
- 根拠: `git show 4417cbd:.orchestration/audit/2026-08-18-adversarial-full-review.md` の C-3 節、および同レビューのガバナンス層所見 F1(path-boundary ガード dead code)/ F4(review collector が writer 支配 manifest を信頼)。
- ブランチ: `agent/ADV-FIX-03` を最新 `origin/main` から作成。PR base=main、`ai-generated` ラベル、draft 禁止、テンプレート記入、自動マージ禁止。
- 注: branch protection ruleset の適用(gh api POST)は **owner 側作業のため本タスク対象外**。

## Objective

P8-T02 で実装済みだが未結線の path-boundary ガードを `coding-task.yml` の agent 実行前後に結線し、独立レビュー collector の manifest を writer 非支配のダイジェストで固定する。prompt-injection された agent の scope 外書込が commit/push 前に fail-closed で止まる状態にする。

## 実装項目

### 1. F1: path-boundary action を coding-task.yml に結線
- `.github/actions/run-coding-agent/path-boundary/action.yml` の入力仕様(pre/post、manifest、`PATH_GUARD_INTEGRITY_KEY`、snapshot 位置)を読み、その設計どおりに `coding-task.yml` の agent 実行 step の前後へ組み込む。
- pre: manifest の allowed paths snapshot を取得。post: worktree 差分を検証し、violation 時は commit/push step に到達させず fail(callback は既存の失敗系statusで台帳へ)。
- manifest の供給源は既存設計(P8-T02 の task manifest / `contracts/agent-task` 系)を調査し一致させる。**供給源が本番経路に存在しない場合は、勝手に新設せず blocked で設計提案を報告**。
- 秘密(`PATH_GUARD_INTEGRITY_KEY`)は既存の secrets 供給方式(OIDC/credential-issuer or repo secret)に従う。新しい長期秘密の発明は禁止。

### 2. F4: collect-agent-review.mjs の manifest digest 固定
- `scripts/collect-agent-review.mjs` に `manifestDigest` 入力を追加し、レビュー対象 checkout から読んだ manifest がそのダイジェストと一致することを検証(path guard の `manifestDigest` 方式 `coding-agent-path-guard.mjs:221` に整合)。不一致は fail-closed(レビュー成果物に findings として記録し exit 非0)。
- 呼び出し側 `.github/workflows/coding-task-review.yml` で、writer が変更できないソース(dispatch 時に orchestrator/queue が確定した値)から digest を渡す。dispatch payload に digest が無い場合は供給側の最小追加(coding_tasks 台帳→dispatch inputs)まで許可するが、schema 変更が要るなら blocked で報告。

### 3. テスト・検証
- `scripts/coding-agent-path-guard.test.mjs` 同等の粒度で collector の digest 検証テストを追加(改竄 manifest / 欠落 digest / 一致ケース)。
- workflow は `mise run actionlint` green 必須。workflow 単体の実行検証は不可能なので、(a) action への入力が既存 workflow の実データで満たせることの静的検証、(b) ガード script のローカル実行での pre/post 動作確認、を validation に記録。

## Allowed files

- .github/workflows/coding-task.yml
- .github/workflows/coding-task-review.yml
- .github/actions/run-coding-agent/** (path-boundary 結線に必要な範囲)
- scripts/collect-agent-review.mjs
- scripts/*.test.mjs / tests/**
- contracts/agent-task/**(digest 供給に必要な最小限。schema 変更が必要なら blocked)
- .orchestration/{reports,validation,sandboxes,learning,autoskill/runs}/ADV-FIX-03*
- .agents/worklog/codex/**

## Forbidden actions

- ruleset/branch protection の適用操作; 依存追加; product コード(packages/)変更; ガード本体の弱体化(allowlist 拡大・検証削除); 新規長期秘密の発明; draft PR; merge; force push。

## Validation(exit code 単独記録)

1. `node --test scripts/` 系テスト(既存+新規)
2. `mise run actionlint` / `mise run governance` / `mise run lint` / `mise run traceability` / `mise run format`
3. path guard のローカル pre/post 実行証跡(violation 検知が fail することを含む)

## Expected artifacts

- report: .orchestration/reports/ADV-FIX-03-REPORT.md([memory:decision] マーカー、cost: 行)
- validation: .orchestration/validation/ADV-FIX-03-validation.md
- sandbox: .orchestration/sandboxes/ADV-FIX-03-SANDBOX.md
- learning: .orchestration/learning/ADV-FIX-03-learning.md
- autoskill: .orchestration/autoskill/runs/ADV-FIX-03.md
- CompactionDB: 標準 waiver 適用(CLI 不在なら unavailable 記載、consolidation は受入時にオーケストレータ)。

## Done

`AGMSG-RESULT v1 task_id=ADV-FIX-03 status=ready_for_review|blocked ...`。max_turns=60。設計上の不確定点(manifest 供給源・digest 経路)は実装強行せず blocked で提案すること。
