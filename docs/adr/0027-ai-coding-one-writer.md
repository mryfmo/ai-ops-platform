# ADR-0027: AI codingは1タスク1Writer、隔離runner、PR-only、人間mergeで統制する

## Status

Accepted（2026-08-11 Owner 承認。根拠: 承認済み baseline-delta と pack 取込の Owner 承認（PR #152）、P0 フェーズでの本 ADR 群に基づく実行実績、および ENV-DEC-001 / ADR-0029 の Owner 裁定。取込元: docs/plans/2026-08-final-architecture/10_adrs/。承認署名 = 本 Status 変更 PR への Owner approve（ruleset 20678089 強制下）。2026-08-10 取込時は Proposed）

## Decision

Claude CodeとDroidはTemporal task routerから1 Writerだけ選ばれ、GitHub Actions/ephemeral runnerでtask branchへ変更しPRまで作成する。Codexは独立reviewまたは指定taskのWriter。provider keyではなくLiteLLM virtual key、MCPはagentgateway profileを使う。同じbranch同時編集、main push、auto merge、production direct mutationは禁止する。

## Supersession

ADR-0006を拡張し、Droid enablement、gateway credentials、one-writer lock、independent Codex reviewを定義する。

## Amendment（2026-08-18、P8-T05）

Droid runner は Factory 公式 direct binary `0.174.0`（Linux x64 SHA-256
`e73592e3c6fc5a754f21b995f27ef686ca0a5096c9a91f2019fb8a3b10a56bbc`）を固定し、
standalone auto-update を無効化する。配布経路と checksum layout は Factory の
[Droid CLI reference](https://docs.factory.ai/droid-cli/cli-reference) を正本とする。

P8-T05 で成立するのは **structure parity** までであり、Droid 実行は無条件 gate により
fail-closed のままとする。cost/token hard ceiling は P8-T03 issuer が発行する task-scoped
LiteLLM virtual key の budget/expiry を正本とし、runner には provider key / master key を
渡さない。Droid の project settings は custom model をこの virtual key と LiteLLM endpoint
だけへ結線し、MCP、network、commit/push、deploy command を拒否する。

gate を有効化できるのは、次をすべて満たした Owner-reviewed amendment 後だけである。

1. `FACTORY_API_KEY` をリポジトリへ保存せず、runner の Factory credential gate から注入できる。
2. task-scoped LiteLLM key の model alias、cost/token budget、expiry が P8-T03 契約どおりである。
3. turn 上限を実行中に強制できることを、native flag または承認済み stream-JSONRPC wrapper で証明する。
4. test repository の real Droid E2E で `agent/*`、tool/network/deploy deny、runtime/cost/token/turn
   ceiling、構造化 evidence、PR-only/human-merge を確認する。

上記 E2E 完了前に、Droid が Claude と active parity に達した、または実行可能であるとは扱わない。
