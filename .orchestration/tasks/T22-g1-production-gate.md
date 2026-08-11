# T22 (G1): 本番ゲート — ガバナンス + フェイルセーフ実効化

## Objective

ベストプラクティス監査 `.orchestration/audit/2026-07-09-bestpractice-BC.md`(領域B)と `-A-ops.md`(A-9)の本番前ブロッカーを是正する。**両監査を必読**。CRITICAL 1 + HIGH 5。

## ブランチ

- `agent/T22` を `agent/T21` から作成、PR base は `agent/T21`(スタック継続、PR 説明に明記)。着手前に `/compact`

## 是正項目(バグ/挙動変更は再現・回帰テスト先行)

### B-1.1 CRITICAL: CODEOWNERS プレースホルダ
- `.github/CODEOWNERS` の `@OWNER` を実在の owner に置換。**実アカウント名は不明なので、プレースホルダを `# TODO(human): replace with real GitHub user/team before go-live` を付した明示 TODO + リポジトリ運用者が置換すべき旨を AGENTS.md と runbook に記載**(codex は実アカウントを勝手に創作しない)。加えて、置換忘れを検出できるよう、CODEOWNERS に未解決プレースホルダ(`@OWNER`)が残っていたら CI で警告するチェックを追加(fail でなく warn でよい、理由を report に)

### B-1.3 HIGH: AI PR が GITHUB_TOKEN で CI を起動しない
- `coding-task.yml` の PR 作成を、CI を起動できる方式に変更。GitHub App installation token か専用 PAT を使う設計にし、**シークレット名(例 `AIOPS_PR_TOKEN`)を参照する形**にする(実シークレット値は設定不可なので、未設定時は明示的に失敗し手順を runbook 化)。あわせて、AI PR で `ci.yml` が確実に走ることを保証する経路(App トークン経由 or 明示的な CI 呼び出し)を実装。どちらを採ったか report に

### B-4.1 HIGH: gitleaks-action v2 の org ライセンス問題
- `ci.yml` の `gitleaks/gitleaks-action@v2` を、org で無償に動く方式へ: gitleaks CLI(MIT)を直接ダウンロードして実行するステップに置換(SHA/バージョン固定)。秘密検出時に fail。`GITLEAKS_LICENSE` 依存を除去

### B-2.1 HIGH: Actions の SHA ピン
- 全ワークフロー(ci.yml/coding-task.yml/report-generation.yml)の全 `uses:` を 40 桁コミット SHA にピン留めし `# vX.Y.Z` コメントを付す。ローカル `./.github/actions/*` は対象外。SHA は各アクションの当該タグのコミットに対応する正確な値を用いる(不確実な場合は WebFetch で GitHub の該当タグの commit を確認してから記載。捏造しない)

### B-3.1 HIGH: Dependabot
- `.github/dependabot.yml` を追加。エコシステム `npm`(pnpm)+ `github-actions`、グループ化更新、週次

### A-9 HIGH: フェイルセーフ実効化
- `activateFailsafe` を実効化: `isFailsafeActive()` を各 side-effect スケジューラタスク(reportDelivery、events dispatch、jitRevocation の変更系、codingTask 実行)の run 冒頭で参照し、**変更系を短絡**(REQ-029 どおり revoke/notify は許可、auto-deploy/close/grant は停止)。`/readyz` も failsafe 時に false を返す。フェイルセーフ発火→変更系停止→解除→再開のテストを追加。VERIFICATION_REPORT の「停止は未実装」記述を「実装済み」に更新(過大申告にならないよう、実装した停止範囲を正確に書く)

## 規約 / Forbidden

- DoD: 並列 `mise run ci` green。依存追加は Dependabot 設定に伴うものなし(dependabot.yml は設定ファイル)。実 API 呼び出しなし。マージ禁止。`.orchestration/` は commit しない。audit_log への UPDATE/DELETE なし
- **無音スタブ・過大申告禁止**(T18/T21 で revise した点)。設定不能な実シークレット/実アカウントは、創作せず TODO+runbook 化し、未設定時に明示失敗させる
- SHA・バージョンを推測で書かない(不確実なら WebFetch で確認)

## Expected artifacts(絶対パス)

- report: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/reports/T22-report.md` — 項目ごとの fixed / documented(TODO 化)対応表
- validation: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/validation/T22-validation.txt`
- sandbox / learning / autoskill: 同ディレクトリ T22-*.md

## Done signal

```sh
~/.agents/skills/agmsg/scripts/send.sh ai-ops-platform codex-gpt55-high orchestrator-fable5 'AGMSG-RESULT v1 task_id=T22 status=ready_for_review report=... validation=... sandbox=... learning=... autoskill=...'
```

max_turns: 60
