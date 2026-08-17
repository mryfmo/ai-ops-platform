# P10-T03 Sandbox

OpenSandbox was not available. The fallback was Terraform's native AWS mock
provider in disposable module copies plus the repository's digest-pinned loopback
Floci emulator. Both entrypoints reject ambient AWS credentials/endpoints before
execution. No real AWS endpoint, account, credential, ARN, or persistent external
effect was used. Full CI required a sandbox-external rerun because `tsx` needs a
local IPC socket; it targeted only a fresh loopback PostgreSQL container named
`aiops-p10-t03-postgres`. That container was stopped and deleted after CI; the
pre-existing `aiops-p001-postgres` container was untouched.
