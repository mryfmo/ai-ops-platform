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

## Evidence（適用後に記入）

- 適用日時 / 実施者: PENDING(ENV-DEC-011)
- ruleset ID / URL: PENDING(ENV-DEC-011)
- 負証明ログ: PENDING(ENV-DEC-011)
