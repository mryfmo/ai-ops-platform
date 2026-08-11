# A046 learning

- An immutable canonical snapshot and mutable notification progress require distinct boundaries. The safe overlay is monotonic: `max(snapshot baseline, operational DB)`, followed by an atomic success-only increment capped by the business rule.
- Raw SQL constraint testing must be paired with a real repository test. The Crit round caught this and added actual `Pool` concurrency coverage.
- Authorized edits to `docs/spec/prjops/*.md` must also regenerate `docs/PrjOps.zip`; governance rejects mirror-only changes.
- Reusable validated learning was recorded in `.agents/worklog/codex/learn/20260809_100200_learn.md` and indexed.
