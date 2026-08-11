# A035: 入力の上限と期限切れの検知を入れる

- task_id: A035
- repo: /Users/mryfmo/Workspace/ai-ops-platform（worktree は割当時に指定）
- 発行: claude-deep-dot（orchestrator）2026-08-07
- 担当: 割当時に記入
- max_turns: 40
- 根拠: `docs/audit/2026-08-05-adversarial-review/` の
  **ADV-INT-054 [Low]**（02章）、**ADV-OPS-010 [Low]**（05章）、**ADV-OPS-008 [Medium]**（05章）

## 背景（いずれも「気づけない」ことが本体）

3件とも「壊れていることに気づく手段が無い」という同じ形の欠陥である。壊れた後に直す話ではなく、
壊れたときに分かるようにする話として扱うこと。

### ADV-INT-054: `/webhooks/graph` に body サイズ制限がない

`bodyLimit` は xlsxImport（`packages/server/src/http/routes/xlsxImport.ts:123`）にしか無い。
`graphNotifications`（`packages/server/src/http/routes/graphNotifications.ts:92`）は
**無認証のまま** `c.req.json()` で全部読む。LB/WAF の実設定は未確定（T-P1-07）なので、
アプリ側が唯一の防壁である。

### ADV-OPS-010: 祝日カレンダーの有効期限を誰も見ていない

`packages/shared/src/calendar/jp_holidays.yaml` は 2027-11-23 まで収録。データは足りているが、
`businessCalendar.ts` にも起動時にもカバレッジ検証が無い。期限を過ぎると
**祝日が silently 営業日扱い**になり、報告・督促のタイミングが狂う。年1回の手動PRだけが頼り。

### ADV-OPS-008: dead letter を戻す手段がゼロ

`aiops_events_queue_depth{status="dead"}` は出ている。しかし
`ops/prometheus-rules.yml` に dead 深度のアラートが無く、dead → queued へ戻す関数・CLI・
ルートがどこにも無い（`eventsRepo.ts` に該当メソッド無し、`docs/reference/cli.md` にも記載無し）。
全 runbook に "dead" の扱いが一切登場しない。max attempts 到達イベントが永久に放置される。

## 実装要件

1. **body サイズ制限**: `/webhooks/graph` に `bodyLimit` を入れる。上限値は xlsxImport の既存値を
   参考にしつつ、Graph の change notification の現実的な最大サイズを踏まえて決め、**根拠をコメントに書く**。
   超過時の応答コードと、それが監査に残るかを明示すること。
2. **カレンダー期限の検知**: 起動時にカレンダー最終日までの残日数を評価し、閾値未満なら warn と
   メトリクスを出す。**判定は純粋関数として `packages/shared/src/calendar/` か
   `packages/server/src/lib/` に置く**（CLAUDE.md 原則1）。閾値はハードコードでよいが根拠を書く。
3. **dead letter**: (a) `ops/prometheus-rules.yml` に dead 深度のアラートを追加、
   (b) `eventsRepo` に dead → queued へ戻すメソッドを追加（attempts のリセット方針を明示）、
   (c) runbook に復旧手順を記載。**HTTP ルートは追加しないこと**（外部から叩ける再実行経路は
   別途の判断が要る。CLI かリポジトリ層まででよい）。

## 判断が必要になったら

次に該当したら**推測せず `status=blocked` で報告**すること。

- body 上限値が Graph の仕様上明確に決まらない場合
- dead → queued の再投入で、attempts をリセットするか維持するかが監査の意味を変えると判断した場合
- 既存の runbook 構成に収まらず、新規 runbook ファイルが要ると判断した場合

## 品質要件

- 新規ファイルの先頭に根拠IDヘッダ（`根拠: <REQ/SPEC-INT/AC/ADR>`）。**衝突IDは namespace を付ける**
  （両 spec-ids に存在するIDを bare で書くと `ambiguous bare reference` で落ちる）
- describe/it のタイトルに検証対象の仕様IDを含める
- `mise run ci` green（**実 PostgreSQL が必須**。未設定なら `mise run db:require` が手順を表示する）
- 生成物 `packages/traceability/output/traceability_matrix.md` が変化するなら**再生成してコミットする**
- push → PR（base=main、`ai-generated` ラベル）→ checks green → AGMSG-RESULT
- **merge は行わない**（ADR-0006。受入は orchestrator が行う）

## forbidden_actions

- `allowed_files` 以外の編集
- `/webhooks/graph` の認証方式そのものの変更（clientState 検証の設計は別所見）
- dead letter 再投入の HTTP ルート追加
- 依存関係の追加・更新
- `docs/audit/` 配下の編集
- merge、force push、他ブランチへの push

## allowed_files

```
packages/server/src/http/routes/graphNotifications.ts
packages/server/src/lib/calendarCoverage.ts
packages/server/src/db/eventsRepo.ts
packages/server/src/index.ts
packages/server/src/observability/metrics.ts
packages/server/tests/graphNotificationsBodyLimit.test.ts
packages/server/tests/calendarCoverage.test.ts
packages/server/tests/eventsRepoDeadLetter.test.ts
ops/prometheus-rules.yml
runbooks/manual-ops.md
```

## 完了報告

```
AGMSG-RESULT v1 task_id=A035 status=ready_for_review|blocked report=.orchestration/reports/A035-report.md validation=.orchestration/validation/A035-validation.md sandbox=.orchestration/sandboxes/A035-sandbox.md learning=.orchestration/learning/A035-learning.md autoskill=.orchestration/autoskill/runs/A035-autoskill.md
```
