# A051 Sandbox

- Branch: `agent/a051-approval-scope`
- Base: `a6f4b4b3fdcd17a554adce886c30b6d1f30dd221`
- PostgreSQL: pre-existing disposable loopback instance at `127.0.0.1:55440`; A051 used dedicated clean databases `aiops_a051_test` and `aiops_a051_test2` only.
- The local Web production build used `next build --webpack` after both sandboxed and escalated Turbopack builds were denied by macOS Seatbelt process/port restrictions.
- No dependency, identity-envelope, schema, merge, force-push, production-data, or production-service mutation was performed.
- Unrelated untracked `.pnpm-store/` and `references/ai-ops-platform-final-implementation-pack_2026-08-09.zip` entries were not staged or modified intentionally.
