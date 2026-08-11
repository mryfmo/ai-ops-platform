# オーナー裁定事項 — 2026-08-05 敵対的レビュー是正

出典: `docs/audit/2026-08-05-adversarial-review/`（所見 82 件。内訳: レビュー本体 81 件のうち
ADV-VER-013 は撤回済みで有効 80 件 + 是正作業中に判明した ADV-VER-014 / 015 の 2 件。
いずれも file:line 付き。最終更新 2026-08-07）
目的: **ワーカーが推測で決めてしまうと手戻りになる事項**を先に確定する。ここが未決のまま task file を書くと、AGMSG-TASK の `allowed_files` と完了条件が定義できない。

判定欄の記入者はオーナー（人間）。エージェントは記入しない。

---

## D-01 承認フローの設計【最優先・Critical をブロック】

対象所見: AUD-OPM-001（旧監査 Critical、2026-07-11 から未変化）、ADV-WIR-007、T-P0-13、T-P0-14

現状: `packages/devops/src/agents/AGT_CHG.ts:88` が `openUrlActions: [{ title: "承認判断を開く", url: decisionUrl }]` を送るが、**受け口のルートも DB テーブルも存在しない**（`http/app.ts` の登録ルート 8 系統に decision 系なし、`schema.sql` の CREATE TABLE 27 件に approvals なし）。

裁定が必要な点:

1. **承認 UI の置き場所** — (a) WebUI（Next.js）の認証セッション配下に承認画面を作る / (b) Hono に専用ルート + 署名トークンで受ける / (c) その他。
   - 制約: ADR-0005 が Bot Framework 不採用・`Action.Submit` 不可を決めているため、Teams カード内で完結する案は取れない。
   - 参考: (a) は Entra セッションで承認者同一性が自動的に取れる（DEC-SPEC-002 の `(entra_tenant_id, entra_object_id)` を満たす）。(b) は ADV-SEC-010（誰が押したか記録されない）を再発させる。
   - 判定: ______

2. **承認記録の保存先** — 新テーブル `change_approvals` を作る / 既存 `deployments` に列追加 / その他。
   - 制約: AGENTS.md「schema.sql 変更手順」により、既存テーブルの ALTER は migration 新規作成が必須。
   - 判定: ______

3. **承認者の同一性要件** — Entra object_id を必須にするか、表示名のみで可とするか。
   - 参考: DEC-SPEC-002 は認可主体を `(entra_tenant_id, entra_object_id)` と定め email を表示属性へ降格済み。
   - 判定: ______

4. **対外レポートの配信前承認（T-P0-14）を同じ基盤に載せるか** — 載せる / 別基盤 / 今回は対象外。
   - 参考: `standard_reports` に approval_status / 承認者 / 承認時刻の列が無い。LLM ナラティブ入りレポートが人間承認なしで investor/executive へ配信され得る状態が継続中。
   - 判定: ______

---

## D-02 エージェントの起動主体【14 エージェント結線をブロック】

対象所見: ADV-WIR-001（Critical）、ADV-WIR-002（Critical）、ADV-WIR-006、ADV-WIR-007、ADV-WIR-009

現状: 完全結線は 14 中 2。DevOps の BLD/DEP/INC は監査ログ 1 行で終わる（動的検証で再現済み）。PrjOps 6 エージェントはランタイム呼び出しゼロ。

裁定が必要な点:

1. **DevOps BLD/DEP/INC の実行場所** — 常駐サーバの scheduler / GitHub Actions 側 / ハイブリッド。
   - 参考: ADR-0003 は「DevOps は Actions の 5 分 cron では不足だから常駐が要る」と決めているが、これは 30 秒ヘルスチェックと毎分 JIT 失効の話であり、webhook 起点のトリアージは Actions でも成立し得る。`packages/devops/src/workflows/on-workflow-failure-triage.yml` は Actions 側実装の残骸で、存在しない `scripts/jobs/on-build-failure.mjs` を参照している。
   - 判定: ______

2. **PrjOps AGT-01/03/06 の実行場所** — 常駐 scheduler / Actions cron。
   - 参考: ASM-006 は PrjOps = Actions cron 前提。ただし現状 `packages/prjops/src/workflows/*.yml` は未出荷（AGT01_orchestrator.ts:8 が自認）。
   - 判定: ______

3. **AGT-04 の二重実装をどうするか** — パッケージ実装（`packages/prjops/src/agents/AGT04_*`）を廃止して CI 側（`report-generation.yml` + `packages/shared/src/reporting/*`）に一本化 / 併存。
   - 参考: 併存のまま放置すると、テストが通っている実装と本番で動く実装が別物という現状が固定化する。同型の問題が `freeTextIntent.ts`（AGT-02 の複製、ADV-WIR-012）にもある。
   - 判定: ______

4. **AGT-07（配信前検証）の挿入位置** — `reportDeliveryTask` の送信直前 / `reportIngest` の受信時 / 両方。
   - 参考: 本レビューで最も重いと判定した欠落。外部配信を伴う設計で、数値一致・権限違反なし・受信者と報告主体の一致を検証する唯一のゲート。
   - 判定: ______

5. **JIT 権限の付与側（ADV-WIR-009）をどこから起こすか** — 失効ループは実装済みだが台帳への書き手が存在せず空回りしている。D-01 の承認基盤と統合するか、独立させるか。
   - 判定: ______

---

## D-03 監視データソース【仕様とADRの矛盾】

対象所見: ADV-OPS-003、ADV-OPS-005

現状: 仕様（`docs/spec/spec-id-catalog.md:277`、`docs/spec/devops/06_運用環境表.md:15`）は **Datadog 前提**、ADR-0016:20 は **Log Analytics / App Insights を採択**。TH-003 の自動ロールバックはこの監視 API に依存するため、決まらないと着手できない。

1. **どちらに寄せるか** — App Insights に統一して仕様を改訂 / Datadog を維持して ADR を改訂。
   - 判定: ______
2. **`ops/prometheus-rules.yml`（5 ルール）の扱い** — Azure Monitor アラートへ移植 / Prometheus 互換基盤を別途用意 / 破棄。
   - 判定: ______
3. **HTTP メトリクス（件数・レイテンシ・ステータス）を追加するか** — 現状 `observability/metrics.ts` に無く、99.9% 可用性・p95・5xx はアプリ側から計測不能。
   - 判定: ______

---

## D-04 デプロイ基盤の実体化範囲【Critical 2 件をブロック】

対象所見: ADV-OPS-001（Critical）、ADV-OPS-002（Critical）、ADV-INT-009、ADV-WIR-011

現状: deploy workflow 0 件、`*.bicep` 0 件、`infra/` なし。`deploy-prod.yml` は echo 2 行で `.github/workflows/` の外にある。

1. **Azure サブスクリプション・リソース命名・リージョンの確定** — ADR-0016 は Japan East / Japan West を規定するが実体が無い。
   - 判定: ______
2. **`deploy-prod.yml` の配置先** — 本リポジトリの `.github/workflows/` / デプロイ対象リポジトリ側（AGT_DEP は owner/repo 注入型 dispatch）。後者なら配備手順の正本をどこに置くか。
   - 判定: ______
3. **今回の「完了」の定義** — Bicep 記述まで / ACR push まで / staging への実デプロイまで / 本番 10% トラフィックまで。
   - 制約: ADR-0016:52 が「Bicep build や mock デプロイだけで production readiness を主張してはならない」と明記。ここを曖昧にすると受入基準が食い違う。
   - 判定: ______

---

## D-05 バックアップ方式【`TBD(HUMAN)` 8 箇所】

対象所見: ADV-OPS-004、AUD-OPS-001

現状: ADR-0015 は Status **Proposed** のまま。`runbooks/backup-restore.md:5` は「Do not execute production backup or restore commands from this draft」。5 年保持の監査ログに物理的裏付けが無い。

1. バックアップ技術（Flexible Server 自動バックアップ + LTR / 独自ダンプ / 併用）: ______
2. RPO/RTO の確定値（ADR-0016 は ≤5min / ≤60min を掲げるが未計測）: ______
3. 暗号鍵の所有者と復旧承認者: ______
4. リストア演習を「いつ・どの環境で・誰が」1 回実施するか: ______

---

## D-06 branch protection【GitHub プラン依存】

対象所見: ADV-INT-011、ADV-SEC-001、T-P0-08

現状: 旧監査で `gh` API 403 を実測（現プランで branch protection 利用不可）。ADR-0006 の「人間レビュー必須」に機械的強制が無い。`scripts/check-codeowners.mjs:9-11` は CODEOWNERS が無ければ exit 0。

1. プラン変更を行うか / 代替統制（例: 必須 status check + 手動運用ルール）で当面凌ぐか: ______
2. ADV-SEC-001（Actions に資格情報が残留し pre-commit フック経由で任意 push 可能）は branch protection を最終防壁に据えている。**プラン変更しない場合、この所見の是正は必須**（`persist-credentials: false` 等）。承認: ______

---

## D-07 Plane のフェーズ進行可否

対象所見: ADV-INT-080（Critical）、081、082、083、ADV-SEC-013

現状: `grep -ril plane packages/` = **0 件**。ADR-0019 採択済みだが到達点は Phase A の一部（mapping contract + governance 文書 + CI validator）。

1. **STOP ゲートの解消** — ADR-0019:35-37 が「upstream issue #5757 の negative probe を導入前 STOP gate」と規定。probe を実施するか、ADR を改訂するか: ______
2. **governance 承認証跡の欠落** — `docs/security/plane-data-governance.md:169-172` が承認 basis とする `.orchestration/acceptance/plane-data-governance-owner-approval.md` が**存在しない**。承認を追認して証跡を作るか、承認を取り消すか: ______
3. **Phase B（shadow observation）に着手するか** — 着手する場合、REQ-045 / SPEC-INT-091 / AC-045-1 の spec-ids 登録も同時に行う: ______

---

## D-08 実環境アクセスの手配

対象所見: ADV-INT-053、ADV-OPS-004、T-P0-12、および本レビューの BLOCKED 11 件

1. **Teams 実テナント** — ADR-0005 が「app-only チャネル投稿は実テナント未検証」と明記したまま。RSC `ChannelMessage.Send.Group` が実際に通るかを確認しないと、Teams 返信・カード配信が本番で全滅するリスクが残る。手配: ______
2. **Docker 実行環境** — ローカルに Docker/colima が無く、イメージビルドが検証できない（本レビューでも BLOCKED）。CI 上でのビルド検証で代替するか: ______
3. **`runbooks/e2e-real-environment.md` のチェックリスト 1 周を誰がいつ実施するか**（全項目未チェック・実行記録ゼロ）: ______

---

## D-09 secretSanitizer の強化範囲

対象所見: ADV-SEC-006

現状: `sanitizeForLlmInput` は `sanitizeSecrets` の単純 alias。`maskSuspiciousSequences` は opt-in で本番コードのどこからも有効化されていない。改行分割された `ghs_...` が素通りする（AGT_BLD がビルドログを LLM に渡す主経路なので現実的）。

1. **LLM 入力ゲートで `maskSuspiciousSequences: true` を既定 ON にするか** — トレードオフ: 誤マスクでビルドログの可読性が落ち、LLM の分類精度が下がる可能性がある。
   - 判定: ______
2. **パターン表に追加する対象** — AWS Secret Access Key / Azure 接続文字列・SAS / Slack `xox*` / GCP SA key / `password=` kv / `npm_`。全部追加 / 一部: ______

---

## D-10 範囲記法の受入条件 ID をどう表現するか【2026-08-07 追加】

対象所見: ADV-VER-014（新規。監査 81 件に含まれない）

現状: `docs/spec/prjops/03_PRD.md:104,105,109` が定義する `AC-011〜015共通-1`、`AC-011〜015共通-2`、`AC-016-1` が spec-ids にもカタログにも無く、トレーサビリティ上**存在しない**。カタログガードは index ↔ カタログしか突合しないため、正本にしか無い ID はどのガードにも掛からない。

`AC-011〜015共通-1` は権限フィルタ（CLAUDE.md 設計原則 6 の中核）の受入条件であり、`reportPermissionFilter.ts` から参照されているのに機械検証の外にある。**重要度は高い。**

1. **範囲記法をどう表現するか** — トレードオフ: (a) PRD 側を展開する。**`共通-1` と `共通-2` は別条件なので両系列が必要**で `AC-011-1`〜`AC-015-1` + `AC-011-2`〜`AC-015-2` の計 10 件。片系列だけでは穴が半分残る。正本の文面が変わるが既存文法のまま扱える。(b) ツールの ID 文法に範囲記法を足すと正本は不変だが、文法が複雑化し他所の突合も影響を受ける。(c) 各系列を代表 ID へ正規化するのは最小変更だが、範囲が指す残り 4 プロファイル分が引き続き不可視のまま残る。
   - 判定: ______
2. **`AC-016-1` の登録漏れ** — 文法には適合しているので単純に spec-ids とカタログへ追加してよいか。
   - 判定: ______
3. **正本 ↔ index の突合ガードを追加するか** — 追加すると同種の漏れが今後発生し得なくなるが、PRD の見出し記法に依存する抽出になるため脆い。
   - 判定: ______

---

## D-11 根拠ヘッダの「引用ごと検証」をどこまでやるか【2026-08-07 追加】

対象所見: ADV-VER-015 (c)（PR #131 では閉じない）

現状: 根拠ヘッダガードの正規表現は**ヘッダ内に有効な ID が 1 個あれば通す**。個々の引用は検証しない。`packages/server/src/main.ts:4` は `根拠: ADR-0005 / A-2` で、既に走査対象内にありながら通っている。**走査範囲を広げても閉じない。**

1. **引用ごとに検証するか** — トレードオフ: 実施するには「正当な ID 接頭辞の許可リスト」が要る。本リポジトリには `REQ`/`SPEC-*`/`TH`/`AC`/`ADR` のほか `DOC-ANL-01` / `DEC-SPEC-001` / `P010-F02-T02` / `AUD-*` / `IMP-*` が正当に併存しており、許可リストの網羅性そのものが新たな保守対象になる。網羅漏れは正当なコードを落とす。
   - 判定: ______
2. **`A-NN` スキームをどう扱うか** — `A-2`/`A-4`/`A-9`/`A-11`/`A-11b`/`A-13` が 13 トークン / 10 ファイルで使われているが定義がどこにも無い。(a) 定義文書を作る (b) 仕様IDへ置換する (c) 現状維持。
   - 判定: ______

---

## D-12 テストタイトルの仕様ID を機械検証するか【2026-08-07 追加】

対象所見: ADV-VER-015 の付随（未起票）

現状: AGENTS.md テスト規約は describe/it のタイトルに REQ/SPEC-INT/TH/AC を含めることを求めるが、**検証するガードは存在しない**。実測で 6 件（`migrate` / `metrics` / `pool` / `scheduler` / `serverLifecycle` / `telemetry`）が `A-NN` だけで仕様IDを持たない。

1. **タイトル検証ガードを追加するか** — 追加すると規約が実効化するが、まず既存違反 6 件の是正が要る。またタイトルの自由記述性が下がる。
   - 判定: ______

---

## D-13 生成物 `traceability_matrix.md` の陳腐化をどう防ぐか【2026-08-07 追加】

対象所見: PR #129 レビューで判明（未起票）

現状: `docs/spec/packages.md:45` は当該ファイルを「tracked generated output」と定めるが、**コミット済みの内容が検証器の出力と一致することを何も検証していない**。2026-07-18 付のまま複数のマージを跨いで陳腐化していた（PR #129 で再生成済み）。

**単純なゲート化はできない。** ファイルが生成日時を持つため、再生成すると必ず差分が出る。

1. **生成を決定的にするか**（日時をファイルから外す、または別ファイルへ分離）→ そのうえで「再生成して差分ゼロ」をゲート化する。
   - 判定: ______
2. **あるいは tracked をやめる**（`.gitignore` へ移し CI アーティファクトとしてのみ扱う）。`docs/spec/packages.md` の記述も併せて改める。
   - 判定: ______

---

## 前提作業（裁定不要・着手前に必須）

### P-01 agmsg 識別子レジストリの整理【並列割当をブロック】

`identities.sh <repo> codex` が **10 件**を返す:

```
codex-deep-dot, codex-gpt56sol-high-p001-t01, codex-gpt56sol-high-p005-t01,
codex-gpt56sol-high-p005-t04, t05, t06, t08, t09, t10, codex-gpt56sol-xhigh-p005-t08
```

規約上は健全なら 1 行。複数行は attach 時に「worker identity is ambiguous」警告を出す残留登録で、**この状態でタスクを投げるとどのワーカーに届くか非決定的**。加えて命名がタスク単位（`-p005-t08`）で、「worktree 単位に 1 常駐ワーカー、並列時は全員 `-aNNN` 接尾辞」という規約と食い違う。

対応: 終了済みワーカーを `leave.sh <team> <identity>` で解除し、今回の並列数に合わせて `-aNNN` 付き識別子で再登録する。

### P-02 worktree の準備

並列ワーカーは 1 worktree 1 ワーカー。第 1 波を N 並列で回すなら worktree を N 本用意し、各 worktree の実パスを agmsg の `project` として byte-identical に登録する。

### P-03 ローカル作業ツリーの整理

`agent/T-P0-04` は origin/main に完全マージ済み（固有コミット 0）。untracked 群が `git switch main` をブロックしている。詳細と推奨処遇は `docs/audit/2026-08-05-adversarial-review/07-branch-delta.md`。

---

## 委任裁定記録（D-01〜D-03）— 2026-08-07

オーナー指示（2026-08-07、本文ママ）:「D-01からD-03において、ベストプラクティスな最適解で是正するべきなのではないか」。
これを受け、orchestrator（claude-deep-dot）が既存 ADR・制約に整合する最適解として以下を裁定する。
上の 判定: ______ 欄はオーナー手書き欄として空のまま残し、本節が D-01〜D-03 の有効な裁定である。
オーナーは個別に上書きできる。

### R-01（D-01 承認フロー）

1. **UI は (a) WebUI（Next.js）認証セッション配下**。ADR-0005 が Teams カード内完結を禁じ、
   (b) 署名トークン式は ADV-SEC-010（承認者の同一性が記録されない）を構造的に再発させる。
   (a) のみが DEC-SPEC-002 の `(entra_tenant_id, entra_object_id)` を追加機構なしで満たす。
   AGT_CHG の decisionUrl は WebUI 承認画面を指すよう変更する。
2. **保存先は新テーブル `approvals`（汎用）**。承認は deployments と 1:1 でない（差し戻し・
   複数対象種別）。対象種別 `change | report | jit_grant` を持つ第一級エンティティとし、
   schema.sql は fresh 形、既存 DB は migration 新規作成（AGENTS.md 手順）。
3. **承認者は Entra object_id 必須**。表示名のみは spoofable で DEC-SPEC-002 に反する。
4. **対外レポートの配信前承認も同じ approvals 基盤に載せる**（type=report）。別基盤は
   ADV-SEC-010 と同じ欠陥クラスを二重に作る。`standard_reports` は approvals を参照する。

### R-02（D-02 起動主体）

1. **DevOps BLD/DEP/INC は常駐サーバ一本**（ハイブリッド不採用）。webhook 受信・events
   キュー・dispatcher・監査・DB は既に常駐側に実在し（ADR-0005）、Actions 側は存在しない
   スクリプトを参照する残骸のみ。実行基盤の二重化は AGT-04 二重実装と同じ欠陥クラス。
   `on-workflow-failure-triage.yml` 残骸は削除する。
2. **PrjOps AGT-01/03/06 も常駐 scheduler**。ASM-006（Actions cron 前提）は実体ゼロのまま
   であり、cron 側に置くと secrets 配布・実 PG 接続・監査書き込みが全て二重化する。
   ASM-006 はドキュメント側を改訂し理由を記録する。
3. **AGT-04 はパッケージ実装を廃止し、動いている CI 側（report-generation.yml +
   shared/reporting）を正本に一本化**。「テストが通る実装と本番で動く実装が別物」の解消が本質。
   同型の `freeTextIntent.ts`（AGT-02 複製、ADV-WIR-012）も単一実装へ統合する。
4. **AGT-07 は reportDeliveryTask の送信直前を必須ゲートとする**（bypass 不能な唯一の位置＝
   外部作用の直前）。ingest 側の新設検証は行わない（YAGNI。既存 validator を維持）。
5. **JIT 付与の書き手は approvals 基盤（type=jit_grant）と統合**。承認なしの付与書き手を
   独立に作ることは D-01 の欠陥の再発である。

### R-03（D-03 監視）

1. **App Insights / Log Analytics に統一し、仕様（spec-id-catalog:277・運用環境表:15）を改訂**。
   ADR-0016 が新しい決定であり、Azure 一式構成に対する Datadog は追加ベンダ・資格情報・
   コストのみ増やす。矛盾解消は「新しい決定を正とし、負けた文書を改訂」で行う。
2. **`ops/prometheus-rules.yml` の 5 ルールは Azure Monitor（KQL）アラートへ移植し、移植完了
   時点で削除**（アラート定義の二重正本を残さない）。`/metrics` エンドポイント自体は
   ローカル・CI 検証と scraping 経路として維持。
3. **HTTP メトリクス（件数・レイテンシ・ステータス）を追加する**。99.9% / p95 / 5xx の SLO と
   TH-003 自動ロールバックはアプリ側計測なしに検証不能。Hono middleware で RED metrics を
   `observability/metrics.ts` に実装する。

### 実行順序（レジーム経由・直列）

A037/A038 改訂と wave-3 merge の後: (1) A043 AGT-07 配信前ゲート（R-02-4、最重要欠落）→
(2) A044 approvals 基盤（R-01-1..4 + R-02-5 の受け皿: schema+migration+repo+WebUI 承認画面+
AGT_CHG 結線）→ (3) A045 DevOps BLD/DEP/INC 結線（R-02-1）→ (4) A046 PrjOps 結線（R-02-2）→
(5) A047 AGT-04/AGT-02 一本化（R-02-3）→ (6) A048 監視統一（R-03、仕様改訂+HTTP metrics+
アラート移植）。各タスクは worker=codex-deep-dot（profile deep）、受入は orchestrator。

## D-14 内部用語（V-B 禁止語）リストの内容確定【新規 2026-08-08、A043 で判明】

SPEC-INT-051 は PRF-05/investor 向けに「内部用語」の禁止を定めるが、**用語リストの実体が
リポジトリのどこにも存在しない**（実装・データ・スペック列挙のいずれも無し）。A043 は
機構（`packages/shared/src/reporting` の versioned データ + provider 注入）を導入し、
スペックに明示列挙が無い場合は**空でシード + 起動時 warn** とする（捏造禁止のため）。

- 裁定が必要な点: 禁止語リストの初期内容（どの用語・プロジェクト名・顧客名を PRF-05/investor
  から遮蔽するか）。これはビジネス判断であり、エージェントは決められない。
- 判定: ______

### R-01 補足裁定（2026-08-08、A044 調査結果に基づく）

WebUI→server の認証済み Entra identity 伝搬は **BFF 署名アイデンティティ封筒**方式を採択。
新規 secret `WEB_BFF_IDENTITY_SECRET`（32文字以上・他 secret と同値禁止・未設定時は approvals
ルートを fail-closed 無効化 + degraded 報告）。HMAC-SHA256 canonical 封筒 v1、TTL 90s、
decide の replay は repo 層 CAS が構造的に拒否するため nonce store は意図的に省略（理由を
モジュールヘッダに記録）。代替案（Entra token を server 側で独立検証 / infra 私設リスナ）は
それぞれ token 保持面の拡大 + テナント設定依存、D-04 未裁定のため不採択。

### R-02 補足裁定（2026-08-08、A045 調査結果に基づく）

DevOps:SPEC-INT-030 の「90日・類似上位5件」は incident datastore（特徴量永続化 + 類似検索）を
要求するが未実装。A045 は **注入可能 provider + recency 代理実装（devops_1y triage 90日/5件）**で
結線し、部分適合を provider ヘッダと本記録に明示。将来の類似検索に必要な特徴
（sanitized alert digest / affected_projects / severity）は今日から triage 監査 detail に追加蓄積する。
正式な類似検索実装は **A053** として後続（datastore 設計は仕様どおり）。
AGT_INC の自己ループ（自作 issue の再トリアージ）は LLM 呼び出し前のガードで遮断。

## D-15 プロファイル別報告のプロダクト範囲【新規 2026-08-09、A047 で判明】

ADR-0012 は生成メカニズム（CI headless・共通スキーマ）の標準化であり、REQ-010〜016 /
DEC-SPEC-007（プロファイル別 2〜10 スロット）/ SPEC-EXT-020/021 の**契約の置換を宣言していない**。
現行出荷物は 3 スロット標準報告のみ。A047 は契約の純粋実装（スロット定義・検証・Unicode
数値ガード）を shared/reporting に移植して traceability を維持し、結線は D-15 の裁定待ちとする。

- 裁定が必要な点: プロファイル別報告（executive/investor 等の個別契約）を今後も出荷対象と
  するか、標準報告へ正式に一本化して仕様を改訂するか。
- 判定: ______

（関連: A054 = PrjOps ingest パイプライン（REQ-004/005 のオーケストレーション実装）を
後続タスクとして登録。こちらは仕様どおりの実装であり裁定不要、優先度のみ調整対象。）

## D-16 GitHub code scanning の有効化【新規 2026-08-09、A052 で判明】

TH-001（staging 昇格）の critical count 入力に対応するランタイム正本が存在しない
（リポジトリで code scanning 未設定）。有効化は GitHub 設定・プラン側の operator 判断。
それまで TH-001 は critical 入力 unavailable の fail-closed（昇格スキップ + 監査）で動く。

- 判定: ______

## 委任裁定記録（パック適用）— 2026-08-10

オーナーは 2026-08-10 に `.orchestration/plan/2026-08-10-pack-adversarial-review/02-baseline-delta.md`
の A〜E を**承認**した（発言「承認」）。これにより:

- baseline-delta 承認（A）: パック適用開始可
- PROC-01（B）= 案A: **Claude-writer タスクは Claude 自身が専用 worktree + PR で実装**し、
  Codex が独立レビュー（one-writer/two-model のパック設計を尊重。現行「orchestrator は
  書かない」規約に対する operator の明示 opt-out として記録）
- GitHub プラン変更（C）: ENV-DEC-011 として台帳へ追加（P0-T02 前提。費用判断は継続して Owner）
- WBS 追補（D）: A053/A054 追加、D-14/15/16 の ENV-DEC 統合
- 取込方式（E）: 原本 zip 不変、修正適用済みコピーを docs/plans/2026-08-final-architecture/ へ
