# A045 AGT_BLD / AGT_INC runtime wiring report

## Status

Ready for review. AGT_BLD and AGT_INC are wired into the existing GitHub event dispatcher; AGT_DEP is unchanged and remains deferred to A052.

PR: https://github.com/mryfmo/ai-ops-platform/pull/145 at `522847dd8379dc376e02f38442c48cbb16bbe985`.

## Delivered

- AGT_BLD retrieves the bounded tail of failed workflow job logs via the jobs JSON and per-job plain-text APIs, classifies failures, and posts a sanitized result to the sole canonical PR or a repository issue.
- Fix suggestions require an exact `GITHUB_REPOSITORY` / absolute `GITHUB_WORKSPACE` checkout mapping. Without it, AGT_BLD posts classification-only output and records a loud `build_fix_suggestion_disabled` audit event; it never treats `cwd` as repository identity.
- Unknown/insufficient-confidence classifications do not post. Missing GitHub or LLM configuration produces a loud degraded capability plus audit record. Push and pull-request events remain receipt-only.
- AGT_INC processes only `issues(opened)` carrying the canonical `alert` label and ignores ordinary, `auto-triaged`, and AGT_BLD-marked issues before LLM use. It injects the current MetricsRegistry snapshot plus a 90-day/five-record provider summary.
- Retry idempotency uses a deterministic `source-issue:<number>` body marker and a bounded, fail-closed GitHub search-before-create gate. A retry reuses the existing `auto-triaged` issue instead of creating another.
- Incident classification output is sanitized before GitHub/Teams delivery. New `triage` audit details include a digest of the sanitized alert, sanitized `affected_projects`, severity, source marker, and dedupe state.
- Runtime orchestration lives in `packages/server/src/agents/devopsEventHandlers.ts`, following the repository's `lib/` purity rule under the file-location flexibility ruling.
- Handler failures are not caught and therefore flow into the existing retry/dead-letter mechanism.
- `build_triage` and `incident_triage` are published through the existing degraded-capability surface.

## Ruled partial compliance

The A045 provider is explicitly a recency proxy over `devops_1y` `triage` audit records, not the feature-similarity search required by DevOps:SPEC-INT-030. The injected provider seam and source header state this limitation. A053 is the required successor for canonical similarity.

## Review

Crit data review found one issue: the first implementation capped returned log text but materialized the full response. It was fixed with a streaming 1 MB tail buffer and resolved. GitHub automated review then identified four runtime-boundary issues; all were resolved under the orchestrator's four rulings (alert ingress, retry dedupe, checkout identity, agents-layer location). Evidence: `.agents/worklog/codex/review/A045-crit-comments.json` and PR #145 review threads.

Latest PR checks are green: build-test (run `31285679549`, job `93173923654`), gitleaks (job `93173923662`), and CodeRabbit. All four review threads are resolved.
