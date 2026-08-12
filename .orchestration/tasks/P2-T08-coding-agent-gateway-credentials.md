# P2-T08 Claude Code action credentials の gateway 移行

- task_id: `P2-T08`
- 根拠: FinalArch:LLM-001 / FinalArch:LLM-003 / PRD-003 / FR-LLM-001..007 / ADR-0022 / ADR-0006（AI コーディングエージェント統合）/ ADR-0027（one-writer）
- Writer: codex-gpt56-sol-high（WBS 指定） / Reviewer: claude-code-fable5-xhigh
- depends_on: P2-T02（#185/#186 merged）
- branch: `agent/P2-T08-coding-agent-gateway-credentials`（base = main `25c0124` 以降）
- risk: **high**（CI 上で動くコーディングエージェントの資格経路）

## allowed_paths（WBS）

1. `.github/actions/run-coding-agent/action.yml`
2. `.github/workflows/coding-task.yml`

（注: 上記 2 ファイルのみ。workflow 変更は gitleaks/actionlint が CI 検証する。
config inventory guard は GitHub workflow env に適用されないため 3 点セット不要）

## deliverables / acceptance（WBS）

- **ANTHROPIC_BASE_URL + scoped virtual key**: runner 上の Claude Code は
  `ANTHROPIC_BASE_URL`（LiteLLM gateway URL）+ 専用 virtual key で動作する構成へ。
  secret 参照は GitHub Actions secrets（例 `secrets.LITELLM_CODING_VIRTUAL_KEY` /
  `vars.LITELLM_BASE_URL` — 実値の登録は Owner 操作。workflow は参照のみ）
- **no ANTHROPIC_API_KEY on runner**: workflow/action から `ANTHROPIC_API_KEY` の
  参照・受け渡しを撤去（provider key が runner env に現れない）
- **key model/budget/expiry scoped**: virtual key に要求されるスコープ
  （model=`claude-code` alias 限定・budget 上限・expiry）を action/workflow の
  コメントと report に**運用要件として明記**（key 発行自体は LiteLLM 管理API の
  運用作業で、gateway 実働 env が無い現段階では発行手順の文書化まで）

## verification

- **actionlint**（CI の既存 gate。ローカルでも実行し validation に記録）
- **staging agent dry run**: 実 gateway/секret が無い現段階で可能な範囲を厳密に:
  (a) `act` 等は使わず、workflow の env 組み立てを静的に検証（ANTHROPIC_API_KEY 不在・
  BASE_URL/virtual key の参照形が正しい）
  (b) ローカル oss.3 gateway（deploy/litellm/smoke.sh の要領、SMOKE_MEMORY=4g）に対し、
  runner が使うのと同じ env 形（ANTHROPIC_BASE_URL + dummy virtual key）で
  Claude Code 相当のリクエスト形（anthropic messages + claude-code alias）が gateway に
  到達することを curl 級で確認（実 provider 資格は使用禁止）
  (c) 実 secrets を用いた本 dry run は Owner が secrets 登録後に coding-task workflow を
  1 回起動して確認する旨を report に明記（Owner 操作依存として繰延）
- fresh 使い捨て DB で `mise run ci` exit 0 を単独判定してから push。lockfile 変更禁止

## フロー

App token（`~/.config/aiops/mint-aiops-pr-token.sh`）で push/PR、`ai-generated` ラベル、
merge しない。gitleaks: Bearer リテラルを作らない（変数間接化）。

## 成果物パス

- report: `.orchestration/reports/P2-T08-report.md`
- validation: `.orchestration/validation/P2-T08-validation.md`
- sandbox: `.orchestration/sandboxes/P2-T08-sandbox.md`
- learning: `.orchestration/learning/P2-T08-learning.md`
- autoskill: `.orchestration/autoskill/runs/P2-T08-autoskill.md`
