# ADR-0027: AI codingは1タスク1Writer、隔離runner、PR-only、人間mergeで統制する

## Status

Proposed（2026-08-10 取込。Owner 承認後に Accepted 化。取込元: docs/plans/2026-08-final-architecture/10_adrs/）

## Decision

Claude CodeとDroidはTemporal task routerから1 Writerだけ選ばれ、GitHub Actions/ephemeral runnerでtask branchへ変更しPRまで作成する。Codexは独立reviewまたは指定taskのWriter。provider keyではなくLiteLLM virtual key、MCPはagentgateway profileを使う。同じbranch同時編集、main push、auto merge、production direct mutationは禁止する。

## Supersession

ADR-0006を拡張し、Droid enablement、gateway credentials、one-writer lock、independent Codex reviewを定義する。
