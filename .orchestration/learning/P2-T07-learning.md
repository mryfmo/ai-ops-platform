# P2-T07 learning

- Apple `container --publish` cannot displace a host PostgreSQL already bound to port 55432; the published sidecar appeared healthy internally while host clients still reached Homebrew PostgreSQL. Verify `inet_server_addr()`, `inet_server_port()`, and `version()` from the host client before treating a published port as the sidecar.
- Shared default DB names can retain schema state or collide with another worker. Unique task-prefixed database names created from a fresh template made the full CI run reproducible without touching other workers' databases.
- Vercel AI SDK `streamText()` exposes a gateway HTTP failure as an `error` part on `fullStream`; awaiting `result.text` wraps a no-output stream in `AI_NoOutputGeneratedError`. Smoke probes should consume `fullStream` when they must assert the underlying `AI_APICallError` status and URL.
