# P3-T08 report — Plane reconcile/promotion workflows

- writer: claude-deep-dot / PR #215（final head `36e6640`、4 round で merge）
- 実装: planeSyncWorkflow（親）+ projection/event/promotion の 3 child 分離。
  dedupe 4 要素恒等（文法拘束 + 長さ拘束）、三値 ledger、promotion は
  eligibility read で baseline 固定 → CAS union（created|stale）契約 →
  draft receipt 専用 parser（generic 拒否・矛盾 stale 拒否）
- review 経過: codex findings 001..008。round-1 の 6 件はすべて exact-head
  live probe 付き（恒等衝突 RUNNING 固着 / 空 ID の直接 child write / generic
  receipt 回収 / TOCTOU executed / 運用障害の E-CP-CONTRACT 誤分類 / 親 fixture
  の activity 証跡ゼロ）。round-3 で矛盾 stale の silent 抑止も検出。全解消し approve
