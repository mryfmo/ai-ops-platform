# P4-T03 Sandbox Record

- Source/tests/build: repository workspace only。client unit tests use injected `FetchLike`; no real policy endpoint or credentials。
- Database: existing local disposable PostgreSQL container only。exact test DB names were dropped/recreated immediately before CI。
- OPA runtime: exact pinned image、single read-only `deploy/opa` mount、no host port/public ingress、unique `p4-opa-smoke` container name。
- Network: image was already available locally。smoke calls only the ephemeral container's private IP。
- Sandbox exception: workspace sandbox denied OPA listener creation (`operation not permitted`)。only `./deploy/opa/smoke.sh` was rerun through its scoped approved prefix; no broader shell/network permission was requested。
- Cleanup: smoke trap removed its exact container and smoke bundle。no production service/configuration was enabled。
- Secrets: none read, injected, logged, or committed。
