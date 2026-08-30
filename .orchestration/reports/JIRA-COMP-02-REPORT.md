# JIRA-COMP-02 Report

- status: ready_for_review
- branch: `agent/JIRA-COMP-01`
- base: `979d4e5e537fd7cc2e55718dd368dd2f3e0628ab`
- implementation commit: `04ac21a463119d731e0cd304c98c1be0d7655f74`
- push / PR / registry / external Temporal / Jira / GitHub operation: not performed
- cost: n/a

## Result

- `@aiops/server/bootstrap`を追加した。config、logger、telemetryの3つだけを公開し、server本体は読み込まない。
- Composition entryは`loadConfig → createLogger → startTelemetry`を済ませてから、Jira runtimeとserver rootをdynamic importする。
- server側のJira設定がなければJira seamを作らず、Temporalにも接続しない。設定がある場合だけ、既存のmTLS/token検証を通して`jira-sync`を結線する。
- server imageの起動点を`packages/composition/dist/main.js`へ一本化した。production deployのworkspace symlink構造を残すため、control-planeから`@temporalio/*`までNodeが解決できる。
- `@aiops/server`の既存`.` exportは`main`、`types`、`import`、`default`を維持した。

## Durable facts

- [memory:decision] server imageのproduction entryは`@aiops/composition`に一本化し、`@aiops/server/bootstrap`だけをtelemetry前にstatic importする。
- [memory:decision] server Jira envがなければJira seamとTemporal接続を作らず、通常のserver起動を保つ。
- [memory:decision] pnpm production deployではworkspace symlinkをdist-only packageへ置き換えない。実体側から解決されるTemporal依存を守り、source/testだけを削る。
- [memory:failure] server root barrelのnamed importでもESMはindex全体を評価するため、telemetry開始前のbootstrap境界には使えない。
- [memory:failure] 同じPostgreSQL DBでfull CIを再実行すると、DB検証後のlegacy schemaが次のcoverageと衝突する。最終判定は毎回fresh clusterで行う。

## Validation

- `CI=true pnpm --filter @aiops/composition run test`: 19/19 green。
- temporary production deployで`@aiops/server/bootstrap`、server root、Composition runtimeのimportに成功。`@temporalio/client`の同梱も確認した。
- fresh PostgreSQL 16（port 55503）+ `CI=true mise run ci`: exit 0。`P001 PostgreSQL integration passed`まで完走した。
- Docker CLIは環境にないためimage buildは未実施。Dockerfile、supervisorの静的テストとdeploy成果物の実importで代替した。
- Crit self-reviewはpackage exportのdefault condition欠落を1件検出し、修正後にresolved。`make require-crit-review`はtarget不在だった。

詳細は`.orchestration/validation/JIRA-COMP-02-validation.md`を参照。

## CompactionDB

```bash
python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project --content 'JIRA-COMP-02: The server image has one production entry at @aiops/composition; a minimal @aiops/server/bootstrap subpath initializes config, logger, and telemetry before dynamic imports; absent server Jira environment skips Jira seam construction and Temporal connection; pnpm production deploy keeps workspace symlink topology so transitive Temporal dependencies remain resolvable.'
```

Decision ID: `ad0bc6b9-6646-4443-89ce-01ae07ac6c2f`
