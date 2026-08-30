# GOV-PR-02 Learning

## Reusable lessons

- [memory:decision] standalone testを追加しただけではCI回帰検知にならない。root CIが通る既存test graphへ明示登録し、その上位commandで実行を確認する。
- [memory:failure] branch切替後のpnpm modules状態がlockfileと合わない場合、non-TTYの初回runはmodules purge確認で止まる。`CI=true`を付け、環境停止をtest failureと混同しない。

## Promotion

新規learn / skillは作らない。CI graphの決定は`package.json`とproject CompactionDB decisionに残した。

```bash
python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project --content 'GOV-PR-02: scripts/mint-aiops-pr-token.test.mjs is part of the root governance:check node --test graph so mise run ci detects mint-token regressions.'
```

cost: n/a
