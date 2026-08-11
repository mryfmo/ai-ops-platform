<!-- 根拠: FinalArch:INV-012 / FinalArch:GOV-001 / ADR-0027 / ADR-0006 -->

# 本番ゲート: main branch protection の適用と証明（P0-T02）

- 状態: **ENV-DEC-011 成立（2026-08-11、GitHub Pro 化を Owner 実施。rulesets API の
  403 解消を実測確認）**。適用実施中。
- 適用物: `.github/rulesets/main-protection.json`（bypass_actors 空 = AI トークンを含む
  全 actor が人間レビューを迂回不可）
- 前提（Owner 裁定 2026-08-11）: AI 用第 2 アイデンティティ = **GitHub App**（ADR-0006 の
  `AIOPS_PR_TOKEN`）。コラボレータが人間 1 名（mryfmo）のため、bypass_actors 空 +
  approving review 1 + `require_last_push_approval` の下では「AI が App token で
  branch push / PR 作成し、Owner が approve・merge」する形でのみ運用が成立する。
  App token 整備前に ruleset を有効化してはならない（全 PR が merge 不能になる）。

## 適用手順（ENV-DEC-011 成立後）

0. GitHub App（AIOPS_PR_TOKEN）を整備し、本 PR を App token で作成し直す
   （bot author 化。branch への push も App token で行う）
1. `gh api repos/{owner}/{repo}/rulesets --input .github/rulesets/main-protection.json`
2. `gh api repos/{owner}/{repo}/rulesets --jq '.[].name'` で `main-protection` の存在を確認
3. CODEOWNERS の有効化確認: `gh api repos/{owner}/{repo}/codeowners/errors` が空であること

## 負証明（negative probe。すべて「失敗すること」が合格）

| #   | Probe                                         | 期待結果                    |
| --- | --------------------------------------------- | --------------------------- |
| 1   | AI トークンで main へ直接 push（空 commit）   | 403 / protected branch 拒否 |
| 2   | AI トークンで自己 PR を承認なしに merge       | 405 / review required 拒否  |
| 3   | force push（--force-with-lease）              | non_fast_forward 拒否       |
| 4   | required check red のまま merge               | 405 / status check 拒否     |
| 5   | CODEOWNERS レビューなしで merge（別トークン） | review required 拒否        |

各 probe は実行コマンド・HTTP 応答・タイムスタンプを取得し、本 runbook 末尾の
Evidence 節へ追記する。probe 用の一時ブランチ/commit は実施後に削除する。

- 順序制約: **probe 1 の拒否を確認するまで probe 3（force push）を実行しない**。
  保護が効いていない状態での force push は main を実際に巻き戻すため。
- probe 5 の「別トークン」= GitHub App installation token（App は CODEOWNERS 非該当）。

## Evidence（2026-08-11 実施）

- 適用日時 / 実施者: 2026-08-11T05:03Z（JST 14:03）/ Owner（mryfmo、gh keyring）。
  ENV-DEC-011 = GitHub Pro 化（Owner 実施、rulesets API の 403 解消を実測）
- ruleset ID / URL: **20678089** `main-protection`（enforcement: active、bypass_actors 空）
  https://github.com/mryfmo/ai-ops-platform/rules?ref=refs%2Fheads%2Fmain
- CODEOWNERS: `gh api repos/mryfmo/ai-ops-platform/codeowners/errors` → errors 0 件
- AI 識別子: GitHub App `aiops-pr-bot`（App ID 4554346、当リポジトリのみに
  インストール。Contents/Pull requests/Workflows: Read and write）。
  本 runbook を含む PR #165 は App author + App token push（#161 の後継）

### 負証明ログ（5/5 拒否 = 合格）

| #   | Probe（実施 UTC）                                                       | 実応答（要点）                                                                                        | 結果    |
| --- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------- |
| 1   | main へ直接 push（空 commit、05:03:01Z）                                | `GH013: Repository rule violations` / `Changes must be made through a pull request` / remote rejected | 拒否 ✅ |
| 2   | 承認なし self-merge（checks green、05:08:59Z、PR #166）                 | HTTP 405 `New changes require approval from someone other than the last pusher.`                      | 拒否 ✅ |
| 3   | force push（main~1 へ巻き戻し、--force-with-lease、05:03:13Z）          | `GH013` / `Cannot force-push to this branch` / remote rejected                                        | 拒否 ✅ |
| 4   | required checks 未達のまま merge（05:03:39Z、PR #166）                  | HTTP 405 `2 of 2 required status checks are expected.` + approval 要求                                | 拒否 ✅ |
| 5   | 別トークン（App installation token、非 CODEOWNER）で merge（05:09:01Z） | HTTP 405 `Repository rule violations found` + approval 要求（http_status=405）                        | 拒否 ✅ |

- probe 用一時 PR #166 / branch `probe/p0-t02` は実施後に close・削除済み
- 完全なコマンド・応答ログ: PR #165 のレビュー証跡
  （`.orchestration/validation/P0-T02-probes.log` として evidence sync 対象）

### 運用帰結（activation 以降の標準フロー）

AI の branch push・PR 作成は App token（`require_last_push_approval` により
push 者 ≠ approver が必須のため）。approve と merge は Owner（人間）のみ。
`AGENTS.md` の「自動マージ禁止・マージは人間レビュアーのみ」がプラットフォーム
強制になった。
