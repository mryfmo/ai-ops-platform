# P1-T08 sandbox

- Worktree: `/private/tmp/aiops-p1-t08`
- Branch: `agent/P1-T08-ci-gates`
- Base: `f2c6648ce66d36b707117eb5dc2c77a4cd2391e7`
- Head: `198c02fb7688f173be2fc1c5065525574842137b`
- PR: https://github.com/mryfmo/ai-ops-platform/pull/179
- Product scope: `.github/workflows/ci.yml`, `.mise.toml`, and the `packages/policy` importer in `pnpm-lock.yaml` only.
- Fresh databases: `p1t08_test`, `p1t08_load_test`, and `p1t08_p001`; all three were dropped after successful CI.
- Repo-external local helpers: Node 22 pnpm wrapper and Next.js `--webpack` preload; neither is part of the branch.
- Network use: official OPA GitHub release metadata/checksum and frozen package installs only.
