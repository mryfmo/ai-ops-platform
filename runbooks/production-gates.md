<!-- 根拠: FinalArch:INV-012 / FinalArch:GOV-001 / ADR-0027 / ADR-0006 -->

# 本番ゲート: main branch protection の適用と証明（P0-T02）

- 状態: **ENV-DEC-011 待ち**。現 GitHub Free + private リポジトリでは branch protection /
  rulesets API が 403 を返す（2026-08-10 実測。「Upgrade to GitHub Pro or make this
  repository public」）。本 runbook は裁定成立後に即時適用できる形で手順と負証明を固定する。
- 適用物: `.github/rulesets/main-protection.json`（bypass_actors 空 = AI トークンを含む
  全 actor が人間レビューを迂回不可）

## 適用手順（ENV-DEC-011 成立後）

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

## Evidence（適用後に記入）

- 適用日時 / 実施者: PENDING(ENV-DEC-011)
- ruleset ID / URL: PENDING(ENV-DEC-011)
- 負証明ログ: PENDING(ENV-DEC-011)
