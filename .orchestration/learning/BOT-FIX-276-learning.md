# BOT-FIX-276 Learning

## Reusable lessons

- [memory:decision] Node 22 runtime globals を使う共有 TypeScript config は、TypeScript 6 では ambient discovery に依存せず `types: ["node"]` を明示する。DOM を必要とする Web config は Node base へ混ぜず独立維持する。
- [memory:failure] TypeScript major update の global type failure は source shim や `DOM` lib 追加へ進む前に、実 runtime と既存 `@types/*` inventory を compiler CLI override で確認すると最小差分を選べる。
- [memory:failure] Next.js Turbopack は Node の単純な port bind が通る sandbox でも、内部 worker の process/port 作成が拒否され得る。build script を変更せず、同じ command を許可された外部隔離ジョブで検証する。
- [memory:failure] launchd `submit` job は正常終了後も再起動し得る。終了 marker 書き込み後に sleep させ、controller が marker を読んで job を remove すると単一実行のログを保てる。

## Promotion

新規 Codex learn / skill は作らない。TypeScript 6 の判断は project CompactionDB decision と共有 tsconfig 自体に集約した。

CompactionDB decision command:

```bash
python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project --content 'BOT-FIX-276: TypeScript 6 Node-runtime packages use the shared tsconfig types:["node"]; packages/web keeps its independent DOM-enabled tsconfig; no source or dependency changes are required.'
```

cost: n/a
