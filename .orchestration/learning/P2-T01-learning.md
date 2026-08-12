# P2-T01 learning

- LiteLLM v1.96.2 resolves `os.environ/` values while reading `model_list`, so raw provider model IDs can remain deployment-only.
- Its regular native fallback map does not encode the canonical allowed-error classes. Dedicated context/content-policy fallback lists do not provide a complete allowlist for all canonical forbidden classes.
- Therefore native fallback lists must stay empty until P2-T02 adds an error-classification guard that reads the platform policy. Schema validation should reject a native target map without that guard.
- The reusable validated lesson is indexed at `.agents/worklog/codex/learn/20260812_103017_learn.md`.
- A focused test is not a gate until the normal contracts command discovers it. New contract subdirectory tests must be added to the existing `node --test` invocation in the same change.
