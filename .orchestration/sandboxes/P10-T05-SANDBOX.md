# P10-T05 Sandbox Record

- OpenSandbox was unavailable; implementation used the repository worktree.
- Structural tests used local files and synthetic fixture mutations only.
- Full CI used a dedicated disposable PostgreSQL 16 Apple Container bound to
  `127.0.0.1:55434`; it was stopped and deleted after exit 0.
- No AWS account, ECR repository, ECS service, GitHub Environment deployment,
  production endpoint, tenant, or real credential was reached.
- Network reads were limited to GitHub PR/action metadata through `gh` and
  official AWS documentation needed to verify current ECS deployment APIs.
- Existing uncommitted user/orchestrator files were preserved and excluded from
  staging.
