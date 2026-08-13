# P2-T09 sandbox

- Workspace: `/Users/mryfmo/Workspace/ai-ops-platform`
- Branch: `agent/P2-T09-dual-path-conformance`
- Base HEAD: `5975b06e9ad39712de7b7b93d164f2e469c41823`
- Allowed product writes: `verification/model-gateway/**`
- External network: used only for `pnpm audit` during the final CI rerun
- Containers: pinned LiteLLM oss.3 plus `postgres:16-alpine`; both removed by the suite cleanup trap
- Databases: fresh disposable test databases on local PostgreSQL port 55432
- Production credentials/data: not used
- Pre-existing untracked `.pnpm-store/` and `references/ai-ops-platform-final-implementation-pack_2026-08-09.zip`: preserved and excluded

