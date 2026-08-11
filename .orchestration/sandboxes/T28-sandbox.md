# T28 Sandbox

- First `mise run ci` inside sandbox failed at traceability because `tsx` could not listen on its IPC pipe under macOS temp (`EPERM`).
- Re-ran `mise run ci` with escalated permissions; final run passed without `-j 1`.
- No real API calls were made. GitHub review comments were fetched through `gh api` for triage evidence only.

