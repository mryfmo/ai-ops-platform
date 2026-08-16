# P8-T06 Sandbox Record

- Source: repository workspace plus read-only GitHub PR metadata inspected with `gh`.
- Review target model: tests create a disposable local Git repository; the workflow uses a separate `review-target` checkout and never executes its code.
- Database: a fresh local PostgreSQL 16 cluster on `127.0.0.1:55437` with `aiops_test`, `aiops_load_test`, and `aiops_p001`; it was stopped after CI. No shared or production database was contacted.
- Credentials: no secret, provider key, LiteLLM key, GitHub write token, or production endpoint was read or committed.
- Network/mutation: GitHub access was metadata-only. No push, review, approval, merge, dispatch, or PR state was changed.
- Dependencies: none added; Node stdlib and the existing contracts YAML/Spectral toolchain are reused.
- Parallel isolation: no task file overlaps PR #251 or #252. Root `package.json` and all PR #251 guard/action files remain untouched.
- Existing dirty/untracked worktree files remain unstaged and unchanged by this task; the generated traceability file was restored after CI.
