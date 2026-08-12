# P2-T07 sandbox

- Unit and repository checks ran in the local workspace with injected mocks; no network is used by Web tests.
- Real gateway smoke used Apple `container` VM isolation with the pinned LiteLLM oss.3 image at 4 GiB and a `postgres:16-alpine` sidecar. Only dummy provider model settings were present.
- Full CI used uniquely named fresh disposable databases on the required local PostgreSQL port 55432 to avoid collision with shared default DB names.
- OpenSandbox was not used; the container VM provided the required runtime isolation.
- Cleanup complete: `p2-t07-litellm`, `p2-t07-pg`, and every `p2t07_*` host test database were removed. Images remain in the local container cache and are recoverable/pullable by digest.
