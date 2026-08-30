# JIRA-COMP-02 Learning

- [memory:decision] instrumented ESMの前処理はbarrel named importでは隔離できない。副作用のないbootstrap subpathを作り、root importはtelemetry開始後のdynamic importにする。
- [memory:decision] Jiraを使わないserver環境では、同じComposition entryを通しつつseam生成とTemporal接続を省く。entryの二重運用は不要。
- [memory:decision] pnpm deployのworkspace symlinkは依存解決の一部である。runtimeを小さくする場合もsymlinkを置換せず、source/testだけを削る。
- [memory:failure] `exports`へ`import`だけを追加すると、従来`main`で通ったdefault resolutionが狭まる。root互換を保つなら`types`、`import`、`default`をテストで固定する。
- [memory:failure] DB統合を含むCIは、同じDBの再利用でschema状態が衝突する。再試行もfresh PostgreSQL clusterから始める。

新しいskillは作らない。bootstrap順序は実装テスト、container closureはpackaging test、運用条件はrunbookに置けば十分。

```bash
python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project --content 'JIRA-COMP-02: The server image has one production entry at @aiops/composition; a minimal @aiops/server/bootstrap subpath initializes config, logger, and telemetry before dynamic imports; absent server Jira environment skips Jira seam construction and Temporal connection; pnpm production deploy keeps workspace symlink topology so transitive Temporal dependencies remain resolvable.'
```

Decision ID: `ad0bc6b9-6646-4443-89ce-01ae07ac6c2f`

cost: n/a
