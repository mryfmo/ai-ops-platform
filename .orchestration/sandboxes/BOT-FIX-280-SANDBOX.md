# BOT-FIX-280 Sandbox

- Workspace: `/Users/mryfmo/Workspace/ai-ops-platform`
- Branch: `agent/JIRA-INT-01`
- Base HEAD: `e6f360f1beb63ce8fb8dd2bc3e16ff1c31d386b1`
- Network:実 Jira/GitHub、LLM API へ接続していない。
- Tests: DI/fake fetch、local Temporal replay recorder、fresh local PostgreSQL 16 cluster のみ。
- Package policy: 依存追加なし、lockfile/toolchain/coverage threshold 変更なし。
- Git policy: push、PR、他 branch の変更なし。
- Sandbox note: PostgreSQL shared memory と `.git/index` 書込みに必要な操作だけ管理された昇格で実行した。

cost: n/a
