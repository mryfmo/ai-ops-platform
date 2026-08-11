# T25 (G4): 可観測性 — OpenTelemetry + 構造化ログ + SLO + T24 繰り越し

## Objective

監査 `.orchestration/audit/2026-07-09-bestpractice-A-ops.md` の A-2(HIGH OTel/metrics)/A-1(MED 構造化ログ)/A-13(HIGH SLO)/A-3/A-4(MED /readyz・shutdown)を是正。あわせて T24 繰り越し 2 点。**監査必読**。

## ブランチ

- `agent/T25` を `agent/T24` から作成、PR base は `agent/T24`。着手前に `/compact`

## 是正項目

### A-1 MED: 構造化ログ
- `pino`(JSON・レベル・低コスト)を導入(**このタスクで pino + OTel 関連の依存追加を許可**)。既存 console.* を pino に置換。child logger に既存 `trace_id` を載せ、タスク/ルート境界でログ

### A-2 HIGH: OpenTelemetry / metrics
- `@opentelemetry/sdk-node` + `@opentelemetry/auto-instrumentations-node`(HTTP + pg を自動計装)を導入。エクスポータは OTLP(設定可能、未設定なら no-op/console 相当で本番外は無害)
- カスタム metrics: events キュー遅延/深さ gauge(queued/delayed/dispatched 件数)、task run duration histogram + 失敗 counter、delivery sent/failed counter。`/metrics`(Prometheus)か OTLP push のいずれか(選択理由を report に)
- 未設定時に**無音でなく明示的に「テレメトリ無効」を 1 度ログ**(スタブ隠蔽禁止)

### A-13 HIGH: SLO / アラート方針
- SLI/SLO を 2-3 定義(ingest→dispatch レイテンシ、配信成功率、task 成功率)し、docs に記載。アラート方針(どの metric の閾値で)を runbook 化。実アラート配線は実環境依存なので方針+閾値の文書化+metric の露出まで

### A-3 MED: /readyz が failsafe/shutdown を反映
- (G1 で failsafe→/readyz false は入済み)shutdown 中も /readyz が false を返すよう `shuttingDown` フラグを追加

### A-4 MED: グレースフルシャットダウン
- SIGTERM で: readiness を false → in-flight HTTP を drain(server.close を await)→ scheduler.stop → pool.end、全体を timeout(~25s)で Promise.race し超過なら exit(1)。現状の未 await server.close と drain 欠如を是正

### T24 繰り越し
- SKILL.md/runbook に「マイグレーションは 1 トランザクションで走るため CREATE INDEX CONCURRENTLY 等トランザクション非対応 DDL は使えない(必要時は別手順)」の 1 行注記
- migrate.ts の rollback 二重失敗経路(release(err))のテストを追加

## 規約 / Forbidden

- DoD: 並列 `mise run ci` green。**依存追加は pino + OpenTelemetry 一式(sdk-node/auto-instrumentations/exporter)に限る**。実 API 呼び出しなし。マージ禁止。`.orchestration/` は commit しない。audit_log への UPDATE/DELETE なし
- **無音スタブ・過大申告禁止**。テレメトリ/エクスポータ未設定時は明示ログ(隠蔽しない)。OTel の初期化がテストや起動を壊さないこと(未設定で no-op)

## Expected artifacts(絶対パス)

- report: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/reports/T25-report.md`
- validation: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/validation/T25-validation.txt`
- sandbox / learning / autoskill: 同ディレクトリ T25-*.md

## Done signal

```sh
~/.agents/skills/agmsg/scripts/send.sh ai-ops-platform codex-gpt55-high orchestrator-fable5 'AGMSG-RESULT v1 task_id=T25 status=ready_for_review report=... validation=... sandbox=... learning=... autoskill=...'
```

max_turns: 70
