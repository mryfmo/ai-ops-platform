<!-- 根拠: DevOps:REQ-028, DevOps:SPEC-INT-060, ADR-0005 -->

# 06 動的検証ログ（D1–D8）

実施日: 2026-08-05 / 対象: origin/main = `631fcef018e499f30a4aaa8cdb9e5e605ec83685`（scratchpad 内 detached worktree）
実行環境: macOS (Darwin 25.5.0), mise 管理 Node 22.23.1 / pnpm 11.13.0, Homebrew postgresql@16 (16.14)。Docker/colima **不在**。
生ログ: セッション scratchpad `review-logs/`（セッション終了で消滅するため、判定根拠は本書に転記済み）。

判定凡例: PASS / FAIL / **BLOCKED(requires-real-env)** — リポジトリの検証慣例（verification/VERIFICATION_REPORT.md）に準拠。虚偽の PASS を作らない。

## D1 — `mise run ci` フル実測

- 主張: DoD は `mise run ci` green。旧検証記録には `FAIL mise run ci`（Prettier）あり。
- 敵対予想: green でも検証の穴により保証は虚像。
- **実測: PASS (exit 0)**。governance → lint → traceability → format → build → typecheck → test:coverage 全通過。
- テスト実数: shared 335 / traceability 56 / devops 206 passed + 6 skipped / prjops 387 / server 477 / web 303 passed + 1 skipped ≒ **計 1,764 passed**。
- 特記: 旧監査時の「CI に lint/format が無い」「web テストが CI でスキップ」はいずれも main で解消済み（ci.yml に `pnpm audit --prod --audit-level high`、lint、format が追加され、web に test:coverage script が存在し実行される）。

## D2 — web テスト CI スキップの検証

- 旧所見: `packages/web` に test:coverage script が無く `pnpm -r --if-present run test:coverage` で静黙スキップ。
- **実測: 解消済み**。`packages/web/package.json` に `"test:coverage": "vitest run --coverage"` が存在し、D1 ログで web の 36 テストファイル/303 件が実行・カバレッジ計測（Lines 90.02%）されていることを確認。

## D3 — トレーサビリティ実測

- **実測: PASS**（D1 内で実行、単独でも matrix 再生成確認）。
- 現況値（matrix 2026-08-05 生成）: PrjOps REQ 35: src 100%/test 71%、SPEC-EXT 27: 78%/26%、SPEC-INT 31: 100%/81%、AC 39: 72%/74%。DevOps REQ 27: 100%/67%、SPEC-EXT 25: 72%/28%、SPEC-INT 31: 100%/58%、TH 7: 100%/100%、AC 45: 64%/49%。
- ツールは旧監査時から進化: Implementation Dispositions 表（partial/superseded の明示）、根拠ヘッダ・ADR 参照・名前空間・カタログ・disposition の 6 ガード、ツール自身に 56 テスト。
- 残る構造的限界: 参照存在は substring であり挙動証明ではない（matrix 自身が注記）。AC/SPEC-EXT の source 参照なし多数（PrjOps AC 11 件、DevOps AC 16 件、SPEC-EXT 計 13 件）で green のまま。詳細は 04 章。

## D4 — コンテナランタイム検出（ゲート）

- **実測: Docker 不在・colima 不在**。`psql`/`initdb`/`pg_ctl` は Homebrew postgresql@16 で利用可。
- 帰結: D5 は repo の compose の代わりにローカル使い捨てクラスタで代替実施。D6 は BLOCKED。

## D5 — 使い捨て DB + P001 統合スクリプト

- 主張: schema.sql は fresh DB で機能し、audit_log は追記専用・パーティション退避が働く。過去唯一の実行記録は BLOCKED（Docker 不在）で、**実 DB での成功観測はこれまで存在しなかった**。
- 手順: scratchpad に initdb（PostgreSQL 16.14）、port 55432、DB 名 `aiops_p001`（P001 ゲート準拠、`P001_ALLOW_DISPOSABLE_DB=1`）。Unix ソケットは path 長 103 バイト制限のため `/tmp/aiops_p001_sk` を使用。
- **実測: PASS (exit 0, "P001 PostgreSQL integration passed")** — 初の実データベース成功記録。
  - app_role での INSERT 成功、UPDATE/DELETE 拒否（追記専用の DB 権限強制を実観測）。
  - 不正 retention_class 拒否、範囲外レコードの DEFAULT パーティション隔離、重複 DEFAULT 行があるときのパーティション新設拒否（意図的ネガティブテストの ERROR 出力はすべて期待どおり）。
  - `db:migrate` 2 回連続実行の冪等性、ロールバック検証（copy validation の ERROR も意図的ネガティブテスト）。
- 注意: 初回実行は `pnpm: command not found`（line 174）で落ちた。スクリプトは mise 環境内での実行が前提（暗黙の前提、runbook 未記載）。

## D6 — Docker イメージビルド + 内容検分

- **BLOCKED(requires-real-env: Docker/colima 不在)**。Dockerfile の静的検分は 05 章（ADV-OPS）で実施。

## D7 — サーバ起動セマンティクス

### D7a 空 env 起動

- **実測: PASS**。exit 1、`E-CFG01: invalid server configuration` で必須 10 変数（DATABASE_URL, GRAPH_CLIENT_STATE, GITHUB_WEBHOOK_SECRET, GRAPH_CLIENT_ID/SECRET/TENANT_ID, GRAPH_ALLOWED_TEAM_IDS, GRAPH_ALLOWED_FROM_MAILBOXES, PUBLIC_BASE_URL, CODING_TASK_CALLBACK_SECRET）を列挙し即時終了。秘密値の漏洩なし。

### D7b スキーマ無し空 DB + 最小ダミー env

- 敵対予想: healthz が 200 を返し「嘘の健全」になる。
- **実測: 予想に反し PASS（良い挙動）**。起動時に `relation "audit_log" does not exist` で **fatal startup error → 即終了**。健全に見せかけない。
- ただし警告 1 件を観測: `METRICS_TOKEN is not configured; GET /metrics is unauthenticated`（warn のみで続行）→ 所見 ADV-DYN-001。

### D7c スキーマ適用後

- schema.sql + migrations 8 本すべて手動適用成功（自動適用機構は無い — 05 章）。
- **実測**: healthz `{"ok":true}` 200 / readyz `{"ready":true}` 200 / metrics 200（無認証を実観測）。
- 無署名 webhook POST /webhooks/github → **401 invalid signature（PASS）**。
- 正署名（HMAC-SHA256）workflow_run failure イベント → **202**、events 行が `queued → done`（dedupe_key `github:<delivery-id>` 記録）、audit_log に `SERVER|github_event_dispatched|DevOps:SPEC-INT-010` と `AGT-BLD|github_event_received|SPEC-INT-011` を確認。**イベントバス → エージェントハンドラの結線は実動作**（旧監査の「audit-only で不実行」から前進）。
- 併せて観測: `github_auth_not_configured`（disabled モードの監査記録）、`stakeholder_master_not_configured`（AUD-IMP-003 を明示参照した監査記録）— 未設定は黙殺でなく監査に残る設計を実観測。
- 限界: GitHub 認証 disabled のため AGT-BLD のログ取得以降（分類・PR コメント・Teams 通知）は未検証 = **requires-real-env のまま**。イベントは attempts=0 で `done` になっており、外部 API 不能時の再試行/デッドレター遷移は本検証では発火しなかった。

### 所見 ADV-DYN-001（Medium）: METRICS_TOKEN 未設定で /metrics が無認証公開のまま warn 継続

- 実証: D7b/D7c 実観測 + 起動ログ。運用メトリクス（内部状態・プロジェクト識別子を含み得る）が認証なしで公開される。必須化または disabled+audit パターン（ADR-0014 原則）への統一が妥当。工数 S。

## D8 — 撤収

- テストサーバ kill 済み。使い捨て Postgres クラスタと worktree はレポート確定後に削除（最終確認章に記録）。

## BLOCKED 一覧（requires-real-env）

| 項目                                            | 理由                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------- |
| D6 Docker ビルド・イメージ検分                  | Docker/colima 不在                                                        |
| AGT-BLD の GitHub API 以降の実動作              | GitHub App 実クレデンシャル不在                                           |
| Graph/Teams/Outlook 実送受信・subscription 作成 | 実テナント不在                                                            |
| LLM 実呼び出し（Anthropic）                     | ANTHROPIC_API_KEY 不使用（方針として本レビューでは外部 API 呼び出し禁止） |
| coding-task.yml / report-generation.yml の実行  | GitHub Actions 実行環境・実シークレット不在                               |
