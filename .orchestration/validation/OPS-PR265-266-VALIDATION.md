# OPS-PR265-266 Validation

## Initial Corrected Preflight

- #265 authorized/live head: `b1f895e0a66ab12b83f621e145a4e11369ac9895`.
- #266 authorized/live head before base update: `f45e07524a3c68ba398b4e2f89261f533ce6fbd5`.
- Both authors: `app/aiops-pr-bot`; both bases: `main`.
- Both original heads: `build-test`, `gitleaks`, and `CodeRabbit` successful; `MERGEABLE`; zero review threads.
- Both approvals were verified as bound to their exact original heads.

## PR #265

- `gh pr merge 265 --squash --match-head-commit b1f895e0a66ab12b83f621e145a4e11369ac9895`: exit 0.
- Final state: `MERGED`.
- Merge commit: `8c03db7597275f87395d040051d5b2a241bd08e5`.

## PR #266 Recovery and Merge

- Initial normal match-head merge: rejected because the head was not up to date with `main`; no auto/admin fallback was used.
- `gh pr update-branch 266`: executed once after revise 2 authorization; success.
- New captured head: `c2e6d84b6dd1da58ea85ffd6bb9aedab8d2989a4`.
- New-head CI run `32026218251`:
  - `gitleaks`: success in 11 seconds.
  - `build-test`: success in 9 minutes 55 seconds.
  - `CodeRabbit`: success.
- Final pre-merge state: `OPEN`, `MERGEABLE`, `CLEAN`, zero review threads, head unchanged.
- Reapproval by `mryfmo`: `APPROVED`, bound to `c2e6d84b6dd1da58ea85ffd6bb9aedab8d2989a4` at `2026-08-17T11:52:50Z`.
- `gh pr merge 266 --squash --match-head-commit c2e6d84b6dd1da58ea85ffd6bb9aedab8d2989a4`: exit 0.
- Final state: `MERGED`.
- Merge commit: `6f3a2acbb420928baf08565e235f55f74a6689a4`.

## Final Repository State

- #265: `MERGED`.
- #266: `MERGED`.
- Remote `main`: `6f3a2acbb420928baf08565e235f55f74a6689a4`, equal to the #266 squash merge commit.
- Update-branch pushes for #266: exactly 1.
- Admin merges: 0. Auto-merges: 0. Operations on other PRs: 0.
