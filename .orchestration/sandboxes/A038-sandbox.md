# A038 Sandbox Record

- Filesystem work was confined to the task files plus the orchestrator-approved revision extensions: CLI/package/runbook files, `src/lib/auditActor.ts` and its test, and `.gitleaks.toml`.
- A disposable PostgreSQL 16 cluster was created under `/private/tmp/a038-pg.HXvjMt`, used for full CI, and stopped cleanly after validation.
- GitHub API egress was blocked in the default sandbox as established in A037. Per the orchestrator ruling, `git push`, `gh pr create`, `gh pr view`, and `gh pr checks` ran as approved escalated commands using the existing keyring identity.
- No token was minted or searched for. No browser/web fallback was used.
- No merge, force push, HTTP route, dependency change, or edit outside the allowed product files occurred.
- Review tooling created a local `.pnpm-store`; it was removed before commit and was never staged.
- Revision CI used a disposable PostgreSQL 16 cluster under `/private/tmp/a038-revision-pg.npHCyV` on port 55439; it was stopped cleanly.
- Gitleaks v8.30.1 and the negative-control checkout were isolated under `/private/tmp/a038-gitleaks.YKnhxM` and `/private/tmp/a038-gitleaks-negative.E5d71A`; neither entered the worktree.
- The locally broken Homebrew Node 26 launcher was bypassed with a temporary pnpm wrapper outside the repository; no runtime or dependency file changed.
