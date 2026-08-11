# P1-T07 sandbox

- Worktree: `/private/tmp/aiops-p1-t07`
- Branch: `agent/P1-T07-otel-conventions`
- Base: `77a52b123ebadc9784852c14ac51ed894d959840`
- Head: `c1992afeb364b105cb90bf38784af28970573310`
- PR: https://github.com/mryfmo/ai-ops-platform/pull/178
- Product scope: only `packages/shared/{src,tests}/**` and `packages/server/{src,tests}/**`.
- Validation databases: `p1t07_test`, `p1t07_load_test`, and `p1t07_p001` on local PostgreSQL port 55432.
- Repo-external validation helpers: Node 22 pnpm wrapper and a Next.js `--webpack` preload; neither is part of the branch.
- Network boundary: exporter/SDK mocks only; no vendor endpoint or production configuration mutation.
