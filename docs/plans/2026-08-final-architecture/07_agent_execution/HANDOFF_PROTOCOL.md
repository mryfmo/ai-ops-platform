# Writer / Reviewer Handoff Protocol

## Writer → Reviewer handoff

WriterはPR作成時に以下を機械可読JSON/YAMLまたはPR本文へ記載する。

- task ID、writer profile、base/head SHA
- related requirement/ADR/AC
- changed files and why
- public contract changes
- DB/event/workflow migration
- feature flags and defaults
- external side effects
- commands/result/evidence URL
- skipped checks
- known residual risks
- rollback steps

## Reviewer → Writer handoff

- verdict
- finding ID/severity
- violated contract
- reproducible evidence
- required behavior, not preferred style
- re-review scope

## Ownership transfer

Reviewerが修正を引き取る場合:

1. original Writerがhandoffを宣言。
2. task ledgerのwriter/reviewerを更新。
3. new branchまたは明示的なnew commit rangeを作成。
4. 元WriterはReviewerへ回る。
5. 変更履歴をPRへ残す。

## Prohibited handoff

- chatだけで曖昧に引き継ぐ。
- 同じworking treeを二モデルで同時編集。
- test failureを「環境問題」と断定して証跡なしで渡す。
- unresolved architecture decisionを実装詳細として隠す。
