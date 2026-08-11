# ADR-0027: AI codingは1タスク1Writer、隔離runner、PR-only、人間mergeで統制する

## Status

Accepted（2026-08-11 Owner 承認。根拠: 承認済み baseline-delta と pack 取込の Owner 承認（PR #152）、P0 フェーズでの本 ADR 群に基づく実行実績、および ENV-DEC-001 / ADR-0029 の Owner 裁定。取込元: docs/plans/2026-08-final-architecture/10_adrs/。承認署名 = 本 Status 変更 PR への Owner approve（ruleset 20678089 強制下）。2026-08-10 取込時は Proposed）

## Decision

Claude CodeとDroidはTemporal task routerから1 Writerだけ選ばれ、GitHub Actions/ephemeral runnerでtask branchへ変更しPRまで作成する。Codexは独立reviewまたは指定taskのWriter。provider keyではなくLiteLLM virtual key、MCPはagentgateway profileを使う。同じbranch同時編集、main push、auto merge、production direct mutationは禁止する。

## Supersession

ADR-0006を拡張し、Droid enablement、gateway credentials、one-writer lock、independent Codex reviewを定義する。
