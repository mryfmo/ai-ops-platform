# Production Gates Runbook

## CODEOWNERS

`.github/CODEOWNERS` must use real GitHub users or teams. For this repository, `@mryfmo` was verified with `gh repo view` and `gh api users/mryfmo`.

Before go-live:

1. Confirm each CODEOWNERS user/team is still the intended reviewer.
2. Enable branch protection for `main`.
3. Enable "Require review from Code Owners".

CI fails while `@OWNER`, common CODEOWNERS placeholder tokens, unverified `@user/team` owners, or email-style owners such as `nobody@example.com` remain.
The verified owner allowlist lives in `scripts/check-codeowners.mjs`; update it only after confirming the account/team with `gh`.
This does not prove branch protection is enabled; repository settings must still require CODEOWNERS review before go-live.

## AI PR Token

`coding-task.yml` requires `AIOPS_PR_TOKEN`.

Configure it as a GitHub App installation token or a dedicated PAT with:

- `contents:write`
- `pull-requests:write`
- `issues:write`

The workflow fails before checkout when the secret is missing. This is intentional: PRs created with the default `GITHUB_TOKEN` do not reliably trigger `ci.yml`.

Status (2026-08-11): GitHub App `aiops-pr-bot`（App ID 4554346、当リポジトリのみ）を
Owner が作成済み。付与済み権限は Contents / Pull requests / Workflows (Read and write)。
`issues:write` は未付与のため、coding-task workflow で本 App を `AIOPS_PR_TOKEN` として
使う前に Owner が App 設定へ Issues (Read and write) を追加すること。この項目が
満たされるまで当該 workflow 用途は open のまま。

## Secret Scanning

`ci.yml` runs gitleaks CLI directly. The workflow pins:

- gitleaks version: `8.30.1`
- linux x64 tarball SHA-256: `551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb`

Update both values together after checking the upstream release checksum.

## Upstream Rate Limiting

Before go-live, the deployment owner must configure rate limiting for every public route at the upstream load balancer or WAF. Application-level rate limiting is intentionally not implemented while the deployment platform is undecided.

Record the selected platform, policy/rule identifier, covered routes, limits, test date, test result, and approving owner here before production traffic is enabled. The limits and platform are `TBD(HUMAN)`; this gate remains open until that evidence is present.

## Main Branch Protection（P0-T02）

<!-- 根拠: FinalArch:INV-012 / FinalArch:GOV-002 / ADR-0027 / ADR-0006 -->

- 状態: **適用済み（2026-08-11）**。ENV-DEC-011 = GitHub Pro 化（Owner 実施。
  Free + private 時代の rulesets API 403 の解消を実測）
- 適用物: `.github/rulesets/main-protection.json`（bypass_actors 空 = AI トークンを
  含む全 actor が人間レビューを迂回不可）
- 前提（Owner 裁定 2026-08-11）: AI 用第 2 アイデンティティ = **GitHub App**
  （上記 AI PR Token 節の `aiops-pr-bot`）。コラボレータが人間 1 名（mryfmo）のため、
  bypass_actors 空 + approving review 1 + `require_last_push_approval` の下では
  「AI が App token で branch push / PR 作成し、Owner が approve・merge」する形での
  み運用が成立する。App token 整備前に ruleset を有効化してはならない（全 PR が
  merge 不能になる）。

### 適用手順

0. GitHub App（AIOPS_PR_TOKEN）を整備し、対象 PR を App token で作成する
   （bot author 化。branch への push も App token で行う）
1. `gh api repos/{owner}/{repo}/rulesets --input .github/rulesets/main-protection.json`
2. `gh api repos/{owner}/{repo}/rulesets --jq '.[].name'` で `main-protection` の存在を確認
3. CODEOWNERS の有効化確認: `gh api repos/{owner}/{repo}/codeowners/errors` が空であること

### 負証明（negative probe。すべて「失敗すること」が合格）

| #   | Probe                                         | 期待結果                    |
| --- | --------------------------------------------- | --------------------------- |
| 1   | AI トークンで main へ直接 push（空 commit）   | 403 / protected branch 拒否 |
| 2   | AI トークンで自己 PR を承認なしに merge       | 405 / review required 拒否  |
| 3   | force push（--force-with-lease）              | non_fast_forward 拒否       |
| 4   | required check red のまま merge               | 405 / status check 拒否     |
| 5   | CODEOWNERS レビューなしで merge（別トークン） | review required 拒否        |

各 probe は実行コマンド・HTTP 応答・タイムスタンプを取得し、Evidence 節へ記録する。
probe 用の一時ブランチ/commit/PR は実施後に削除する。

- 順序制約: **probe 1 の拒否を確認するまで probe 3（force push）を実行しない**。
  保護が効いていない状態での force push は main を実際に巻き戻すため。
- probe 5 の「別トークン」= GitHub App installation token（App は CODEOWNERS 非該当）。

### Evidence（2026-08-11 実施）

- 適用日時 / 実施者: 2026-08-11T05:03Z（JST 14:03）/ Owner（mryfmo、gh keyring）
- ruleset ID / URL: **20678089** `main-protection`（enforcement: active、bypass_actors 空）
  https://github.com/mryfmo/ai-ops-platform/rules?ref=refs%2Fheads%2Fmain
- CODEOWNERS: `gh api repos/mryfmo/ai-ops-platform/codeowners/errors` → errors 0 件
- 実施 actor の区別: `mryfmo keyring` = 人間 Owner の admin トークン /
  `App token` = `aiops-pr-bot` の installation token（AI トークン）

| #   | Probe（実施 UTC）                                                                | 実応答（要点）                                                                   | 結果    |
| --- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------- |
| 1   | **App token** で main へ直接 push（空 commit、05:21:15Z）                        | `GH013` / `Changes must be made through a pull request` / remote rejected        | 拒否 ✅ |
| 1+  | 参考: mryfmo keyring（admin）でも同一 probe（05:03:01Z）                         | `GH013` / remote rejected（admin にも bypass なしを実証）                        | 拒否 ✅ |
| 2   | mryfmo keyring で自己 PR #166 を承認なし merge（checks green、05:08:59Z）        | HTTP 405 `New changes require approval from someone other than the last pusher.` | 拒否 ✅ |
| 3   | mryfmo keyring で force push（main~1 へ巻き戻し、--force-with-lease、05:03:13Z） | `GH013` / `Cannot force-push to this branch` / remote rejected                   | 拒否 ✅ |
| 4   | **required check red**（build-test=fail の PR #167、05:23:00Z）で merge          | HTTP 405 `Required status check "build-test" is failing.`                        | 拒否 ✅ |
| 4-  | 参考: checks 未完了（expected）の PR #166 で merge（05:03:39Z）                  | HTTP 405 `2 of 2 required status checks are expected.`（欠落 check でも拒否）    | 拒否 ✅ |
| 5   | **App token**（非 CODEOWNER・review なし）で PR #166 を merge（05:09:01Z）       | HTTP 405 `Repository rule violations found` + approval 要求（http_status=405）   | 拒否 ✅ |

- probe 用一時 PR #166・#167 / branch `probe/p0-t02`・`probe/p0-t02-red` は
  実施後に close・削除済み
- 完全なコマンド・応答ログ: `.orchestration/validation/P0-T02-probes.log`
  （evidence sync 対象）

### 運用帰結（activation 以降の標準フロー）

AI の branch push・PR 作成は App token（`require_last_push_approval` により
push 者 ≠ approver が必須のため）。approve と merge は Owner（人間）のみ。
`AGENTS.md` の「自動マージ禁止・マージは人間レビュアーのみ」がプラットフォーム
強制になった。
