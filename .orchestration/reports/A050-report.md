# A050 Report

- Pull request: https://github.com/mryfmo/ai-ops-platform/pull/150
- Commits: `acb0fcf86aafb7d97a5626c0245366c92ddd8ed0`, revision `4e84ae4b197b9d4e0cd3ecebf6fc9a440bdd14dc`

- Added v2-compatible per-metric project/portfolio scope; new CI producers and signed ingest require scope while stored-v2 reads remain compatible.
- Added versioned public metric IDs/display names; unknown, missing-scope, wrong-domain, and unauthorized metrics are omitted for every audience with runtime warnings.
- Applied the late A050 ruling at the pre-render gate: each narrative slot is grounded independently against post-filter visible metric values. Only slots with ungrounded numeric tokens are masked; clean siblings and all-hidden clean nonnumeric narratives survive.
- Rejected mixed `PJ-*`/`PRJ-*` `REPORT_PROJECT_IDS` at the producer with `E-RPT07`; all-one-domain sets remain accepted and sorted.
- Normalized signed-ingest portfolio scopes before report-ID hashing so reordered retries preserve delivery idempotency.
- Added stakeholder-master email cross-checking and one-scan-per-cycle batch lookup; ST lookup failure/mismatch is E-VER0D.
- Loaded persisted `recipients.scope_mode` explicitly, preserved the PrjOps/DevOps domain through filtering, and failed closed on malformed active recipient records.
- Coupled report delivery to `STAKEHOLDERS_DIR` and documented producer project-domain requirements.
- Replied to and resolved both late review threads with ruling and test evidence.
- Independent review found portfolio-order idempotency as an additional P2; it was fixed with a RED regression and the focused re-review found no actionable regressions.
- GitHub `build-test`, `gitleaks`, and CodeRabbit checks succeeded; merge state is CLEAN and unresolved review threads are 0.
