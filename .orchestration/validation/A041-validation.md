# A041 merge wave 1 validation

## Per-PR gates

For each PR in order, `gh pr view`, a GraphQL review-thread query, and `gh pr checks` confirmed:

- open and non-draft before merge;
- `MERGEABLE / CLEAN` after any transient `UNKNOWN` result settled;
- zero unresolved, non-outdated review threads;
- build-test, gitleaks, and CodeRabbit green.

Each merge used:

```text
gh pr merge <number> --squash --delete-branch
```

After each merge, `git fetch origin main`, `gh pr view --json mergeCommit`, and `git rev-parse origin/main` produced the same SHA:

```text
#131 879377e28da5167bddc2ef2aabc846311b8d8cae
#132 39f47301b0bb7d8aaccf1ab5e763ae4df19ac433
#136 96b8f5b10c1f187f197f4436a75389104057576b
#137 10537a01a3a1bb84407c63b80c4bd2beb9894c8a
```

## Final main validation

```text
git switch main
git pull --ff-only origin main
PASS: fast-forwarded 27bd194..10537a0

git status --short --branch
## main...origin/main

git rev-parse HEAD
10537a01a3a1bb84407c63b80c4bd2beb9894c8a

git rev-parse origin/main
10537a01a3a1bb84407c63b80c4bd2beb9894c8a
```

The three consecutive `git merge-base --is-ancestor` checks exited 0 for #131→#132, #132→#136, and #136→#137.

No code validation was rerun because A041 authorized merge operations only and all accepted PR checks were green immediately before each merge.

