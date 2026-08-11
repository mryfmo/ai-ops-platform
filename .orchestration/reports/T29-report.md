# T29 Report: gitleaks Fixture Allowlist

## Summary

- Branch: `chore/gitleaks-allowlist`
- Base: `main`
- PR: https://github.com/mryfmo/ai-ops-platform/pull/39
- Commit: `f4d3077` (initial T29 commit: `7afe66e`)
- Change: added repository-root `.gitleaks.toml`.
- Scope: allowlist is limited to the three test fixture files named in the task.
- Not changed: fake token fixtures remain in place; `.github/workflows/ci.yml` was not changed because gitleaks reads root `.gitleaks.toml` by default per task instructions.

## Allowlist

The config extends default gitleaks rules and allows only:

- `packages/shared/tests/secretSanitizer\.test\.ts`
- `packages/server/tests/freeTextIntent\.test\.ts`
- `packages/server/tests/pmTimeseriesRepo\.test\.ts`

No broad `tests/**`, package-wide, or rule-wide exclusion was added.

## Validation

- TOML parse and exact path assertion: green (`python3 tomllib`)
- Local `gitleaks detect --no-git --config .gitleaks.toml`: not run because `gitleaks` is not installed locally.
- `mise run ci`: green, normal parallel run (`-j 1` not used).
- `make require-crit-review`: not available in this repository (`No rule to make target`).

## Revise

- Fixed gitleaks 8.30.1 config shape: changed `[[allowlist]]` to `[allowlist]` because the scanner expects `AllowList` as a map, not a slice.
- Kept the allowlist scoped to the same three fixture files only.
- Validation added:
  - `python3 tomllib` parse confirms `allowlist_type=map`.
  - `mise run ci` green, normal parallel run (`-j 1` not used).
  - Local `gitleaks` binary is still not installed; actual scanner confirmation is expected from PR #39 gitleaks check.
