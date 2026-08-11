<!-- 根拠: ADR-0006 -->

# CHORE evidence sync validation

## Repository boundary

- Base: `0989319` (merged PR #170).
- Branch: `agent/CHORE-evidence-sync-2026-08-11`.
- Candidate paths are restricted to `.orchestration/**`.
- Existing evidence remains unchanged; the learning record is 12 lines with
  SHA-256
  `4f849178a2ae7a4abef257e7f74c42f67777fc90d46ef380199a609321bca6da`.
- Candidate secret scan: pass; the sole credential-shaped URL contains the
  literal `<APP_TOKEN>` placeholder.
- `git diff --cached --check` reports trailing whitespace only in the immutable
  `P0-T02-probes.log` command capture; it was not retroactively rewritten.
- The three newly authored CHORE Markdown files pass targeted whitespace and
  Prettier checks.
- `make require-crit-review`: unavailable; the repository has no such target.

## Fresh-database CI

- Recreated `aiops_test`, `aiops_load_test`, and `aiops_p001` on
  `127.0.0.1:55432` before validation.
- Authoritative standalone `env CI=true ... mise run ci`: exit code 0.
- The pipeline completed build, tests, typecheck, lint, format, traceability,
  gitleaks, audit, migration, load, and P001 PostgreSQL integration gates.
- An earlier sandboxed attempt ended at pnpm's denied DNS fetch (exit 130) and
  is classified as infrastructure-only, not a product validation result.
- `pnpm audit --prod --audit-level high`: exit code 0 with one low and two
  moderate advisories.

## Publication gate

- Stage only the explicit evidence paths with `git add -f`.
- Verify the staged boundary, whitespace, authored Markdown format, and secret
  scan before commit.
- Push and create the PR with a GitHub App installation token.
- Require the `ai-generated` label and green GitHub checks.
- Do not approve or merge; Owner approval and merge remain required.
