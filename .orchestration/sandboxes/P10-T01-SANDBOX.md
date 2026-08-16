# P10-T01 Sandbox Record

- OpenSandbox was not available in the worker toolset.
- Fallback: repository-local worktree plus disposable Terraform copies created by
  `mktemp -d` and deleted by an EXIT trap.
- Floci ran in an ephemeral Apple Container named `aiops-floci-modules`, bound to
  loopback only and deleted after the plan.
- PostgreSQL validation used three fresh temporary databases in an existing
  temporary local cluster; the cluster was stopped after CI.
- Network effects were limited to Terraform provider initialization and GitHub
  metadata reads. No real AWS endpoint, plan, apply, or persistent resource was
  contacted or created.
- Existing uncommitted user files were preserved and excluded from staging.
