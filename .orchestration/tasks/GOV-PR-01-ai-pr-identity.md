# AGMSG-TASK GOV-PR-01: AI PR identity 分離の恒久化（ADR-0032 + mint script + 規約）

- task_id: GOV-PR-01
- repo: /Users/mryfmo/Workspace/ai-ops-platform
- 依頼者: claude-deep-dot（orchestrator）
- max_turns: 40

## Objective

AI PR の「作成者=承認者=マージ実行者が全て人間オーナー」という構造欠陥を、**PR作成者をGitHub App（bot）名義へ分離**することで恒久是正する。CI側は既に credential issuer 経由の leased token 設計（P8-T03, coding-task.yml の issue_github step）であり、本タスクは (a) オーケストレータ/ローカル経路の App token 化、(b) 規約・ADR・runbook の正本化を行う。App 実体の作成・installation はオーナーの browser 操作が必須のため**手順書と manifest の提供まで**が本タスクの範囲（credential 実体は作らない）。

## Branch

`git switch -c agent/GOV-PR-01 origin/main`。直接コミット、push禁止。

## Deliverables

### 1. docs/adr/0032-ai-pr-identity-separation.md（新規）

既存 ADR 書式（ステータス/コンテキスト/決定/根拠/影響）で以下を決定として記録:
- AI 生成 PR の author は GitHub App（bot）名義とする。CI 経路は P8-T03 credential issuer の leased installation token、オーケストレータ/ローカル経路は `AIOPS_PR_TOKEN`（`scripts/mint-aiops-pr-token.mjs` で発行）
- 人間（CODEOWNERS）はレビュアー/マージ実行者に専念し、自己承認問題を構造的に解消する
- main ruleset の `bypass_actors` は恒久的に空。緊急時は break-glass 手順（runbook 参照: 一時付与→操作→即時復元→証跡記録）のみ
- bot レビュースレッドへの対応返信・解決はエージェントが行ってよい（人間承認の代替にはならない）
- stacked PR の親をマージする際は、先に子PRの base を main へ retarget するか、ブランチ削除を子の retarget 確認後まで遅らせる（2026-08-30 の #279/#280 CLOSE 事象を根拠に記録）
- ADR-0006 は維持（自動マージ禁止・マージは人間）。本 ADR はその実現手段の具体化

### 2. AGENTS.md「Git / PR 規約」節の更新（最小差分）

- 「AI PR 作成には AIOPS_PR_TOKEN…」行を ADR-0032 参照付きで具体化（bot 名義必須・mint script 参照）
- bypass_actors 恒久空 + break-glass runbook 参照の1行
- stacked PR マージ順序の1行
- 主要参照ドキュメントの ADR 列挙に 0032 追記

### 3. scripts/mint-aiops-pr-token.mjs（新規、依存追加なし）

- env: `AIOPS_GH_APP_ID` / `AIOPS_GH_APP_PRIVATE_KEY_PATH`（PEM ファイルパス）/ `AIOPS_GH_APP_INSTALLATION_ID`
- node:crypto で RS256 署名の App JWT（iat-60/exp+540/iss）を作り、`POST /app/installations/{id}/access_tokens` で installation token を取得して stdout へ出力（token 以外は stderr）。fetch 実装は引数注入可能にし（既存 FetchLike パターン踏襲）、ネットワークなしのテスト `scripts/mint-aiops-pr-token.test.mjs` を追加（JWT 構造検証・env 欠落 fail-closed・HTTP エラー fail）
- 根拠IDヘッダ: ADR-0032 / ADR-0006
- 権限は token 側でなく App 側で最小化する前提を README コメントに明記

### 4. runbooks/ai-pr-identity.md（新規）

- GitHub App 作成手順: App name 例 `aiops-agent`、Repository permissions は **contents: write / pull requests: write / issues: write（ラベル付与用）/ metadata: read** のみ、webhook 不要。設定画面での作成手順と、参考として同権限の manifest JSON を同梱
- installation（対象リポジトリのみ）、private key 生成・保管（コミット禁止・secret store / ローカルは chmod 600）、`AIOPS_PR_TOKEN=$(node scripts/mint-aiops-pr-token.mjs)` → `GH_TOKEN=$AIOPS_PR_TOKEN gh pr create ...` の利用手順
- break-glass 手順: ruleset へ一時 bypass 付与→操作→即時復元→ `.orchestration/` への証跡記録（今セッションの実績手順を正規化）
- CI 経路（P8-T03 issuer）との関係: issuer がデプロイされたら同一 App を issuer に載せる、の接続を明記

### 5. .env.example

- `AIOPS_GH_APP_ID` / `AIOPS_GH_APP_PRIVATE_KEY_PATH` / `AIOPS_GH_APP_INSTALLATION_ID` のコメント行を追加（server Zod config には追加しない — server runtime は使用しないため設定台帳変更は不要）

## Validation（verbatim）

- `node --test scripts/mint-aiops-pr-token.test.mjs`
- `mise run ci`
- `git log -1 --format='%H %s'` / `git status --porcelain`

## allowed_files

- docs/adr/0032-ai-pr-identity-separation.md（新規）
- AGENTS.md（上記最小差分のみ）
- scripts/mint-aiops-pr-token.mjs / scripts/mint-aiops-pr-token.test.mjs（新規）
- runbooks/ai-pr-identity.md（新規）
- .env.example
- .orchestration/{reports,validation,sandboxes,learning,autoskill/runs}/GOV-PR-01*
- .agents/worklog/codex/**

## forbidden_actions

- git push / PR 操作 / GitHub App・credential の実作成 / ruleset 変更
- 依存追加・lock/mise 変更・.github/workflows/** の変更
- LLM API 呼び出し・外部サービス登録

## Expected artifacts

- report / validation / sandbox / learning / autoskill: .orchestration 配下 GOV-PR-01*（cost: 行、[memory:decision]/[memory:failure]、CompactionDB decision コマンド全文）
- done_signal: AGMSG-RESULT v1
