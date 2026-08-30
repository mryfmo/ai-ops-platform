# BOT-FIX-272 Sandbox Record

- Workspace: `/Users/mryfmo/Workspace/ai-ops-platform`
- Task branch: `chore/wave4-checkpoint-sync`; final branch: `main`
- Network side effects: read-only `git fetch` only。LLM API、実アプリ service、PR mutation、push なし。
- Python: stdlib-only self-check。uv cache access のみ管理された昇格を使用。
- Database: disposable fresh PostgreSQL 16 clusters on ports 55482、55483、55484。全 cluster は command trap で停止済み。
- Local state: CompactionDB ledger/spool/health と generated `__pycache__` は ignored でコミットしない。
- Pre-existing main ledger: 一時退避後、`main` 復帰時に `.claude/contextdb/` へ復元済み。task branch で生成された ignored state は `/tmp/BOT-FIX-272-branch-contextdb-local` へ分離した。
- Package/dependency/lock/mise/packages/**: 変更なし。
- cost: n/a
