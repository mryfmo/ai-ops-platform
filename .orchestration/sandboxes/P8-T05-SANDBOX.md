# P8-T05 Sandbox Record

## Isolation

- No Factory credential, scoped LiteLLM key, provider key, production network, or
  repository write credential was used. Droid invocation remained unreachable.
- The public Factory CLI binary was downloaded only to `/private/tmp`; its SHA-256 was
  independently recomputed, and the binary was not committed.
- Full CI used an isolated PostgreSQL 16 cluster under
  `/private/tmp/aiops-p8t05-pg.pHueR3` on loopback port 55457. It was stopped after CI.
- No push, PR, merge, approval, production configuration, or staging E2E operation was
  performed.

## Workspace Safety

- The branch started from accepted P8-T04 head
  `be9b4d1e9ac48cf28ee94c3cff1b5d97f233598d` as required by the same-file dependency.
- Unrelated untracked orchestration records, `.pnpm-store/`, and the reference archive
  were left untouched and will not be staged.
- Only task-authorized action, Factory policy, ADR, contracts, and P8-T05 evidence paths
  are included.
