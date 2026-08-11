# A050 Learning

- The accepted delivery contract is lexical and per-slot: ground numeric tokens against post-filter visible metric values and mask only affected slots. Semantic attribution of equal visible/hidden values is out of scope by ruling.
- Persisted authorization mode must be loaded from its authoritative column; deriving global/project mode from an empty project list is fail-open.
- Master-data cross-checks over many recipients need one validated batch snapshot per delivery cycle, not a filesystem scan per recipient.
- Stored compatibility and producer strictness are separate: stored v2 may omit scope, while new generation and signed ingest require it.
- Producer portfolios must use one canonical project-ID domain and be normalized before report-ID hashing; otherwise mixed authority or reordered retries can break authorization/idempotency.
