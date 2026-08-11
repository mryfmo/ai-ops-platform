# A011 Report

## Outcome

- Branch: `agent/p010-f02-t01-machine-contract`
- Commit / HEAD: `ff030305022b794df1d79cfbeb0af39d2d3f21e0`
- Pull request: https://github.com/mryfmo/ai-ops-platform/pull/105
- PR base: `main` at `7f7ebf112c69966ba4c9dcedaa9949eef8fa9c01`
- PR state: open, ready, `CLEAN`
- Label: `ai-generated`
- The PR was not merged; merge remains gated on orchestrator acceptance.

GitHub CLI was used first for repository inspection, PR creation, PR readback,
review/comment inspection, and hosted checks. No web fallback was used.

## Changes

- Added the DEC-SPEC-001 authoritative `prjops-data` file/lifecycle/checksum contract.
- Added strict schemas for snapshot records, stable-subject migration, contract cases, and checksum vectors.
- Added machine-judged snapshot and identity positive/negative cases.
- Added 17 byte-level golden vectors covering empty, one, multi, order, LF, CR/CRLF, BOM, NFC/NFD, path, symlink, UTF-8, non-regular, and zero-byte checksum boundary behavior.
- Added the DEC-SPEC-002 stable Entra subject and migration-disposition contract.
- Added the DEC-SPEC-003 persona/scope matrix and DEC-SPEC-004 data-handling/retention contract.

No dependency, product code, worklog, `docs/audit`, or other file change was made.

## Gates

- Phase 1 acceptance validator through P010-F01-T11: PASS, 15 records
- Expected DEV-TRUST warning: 13 existing placeholder assignments
- JSON parse, link, JSON Schema compile, fixture-shape, schema-reference, unique-ID, and required-category checks: PASS
- Golden vectors independently recomputed from input bytes: PASS, 17/17
- Unknown-field, duplicate-ID/mapping, dangling-reference, ownership, partial-snapshot, checksum, and identity/migration negative oracles: fixed
- `MISE_LOCKED=1 mise run ci`: PASS
- Crit CLI Codex self-review: P0=0, P1=1 resolved, P2=0; unresolved=0
- Hosted `build-test`: PASS
- Hosted `gitleaks`: PASS
- Hosted `CodeRabbit`: PASS; GitHub review/comment endpoints returned no review comments
- Final linked worktree: clean and synchronized with the pushed branch

`make require-crit-review` is unavailable because the repository has no such Make
target. Browser Crit and a user review request were not used.
