# T25 Sandbox

- No OpenSandbox or real external service was used.
- Network was used only for the approved `pnpm --filter @aiops/server add ...` dependency resolution.
- `mise run ci` needed an approved sandbox-external rerun because sandboxed `tsx` IPC failed with `listen EPERM`; the command itself remained `mise run ci` without `-j 1`.
- No real API calls and no real database calls were made.
