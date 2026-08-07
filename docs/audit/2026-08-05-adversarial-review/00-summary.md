<!-- 根拠: ADR-0006 / docs/audit/00-summary.md（先行監査） -->

# 敵対的レビュー 総括 — ai-ops-platform PrjOps + DevOps + AiOps 基盤

実施日: 2026-08-05
対象: `origin/main` = `631fcef018e499f30a4aaa8cdb9e5e605ec83685`（主対象）+ ローカル `agent/T-P0-04`（`3d29e5c`）の差分
先行監査: `docs/audit/`（2026-07-11、`39b9594` 基準、68 所見）から **190 コミット後**の再評価
手法: 静的敵対レンズ 5 系統 + 旧所見再検証 + ブランチ差分評価（各所見に file:line 実証）、および**実 PostgreSQL・実サーバ起動を伴う動的検証**（06 章）

## 問いへの回答

> 「趣旨と意図に則り、システム基盤が正しく問題なく動作できるようになっているか」

**判定: NO-GO（条件付き GO ですらない）。**

ただしこの判定は「品質が低い」という意味ではない。**基盤部品の品質は高く、旧監査から実質的に前進している。** 成立していないのは、部品を実際の業務フローとして動かす結線と、それを載せて運用する層である。

三つの判定軸での結論:

| 軸                              | 判定         | 根拠                                                                                                                                               |
| ------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| (1) 14 エージェントの実行到達性 | **不成立**   | 完全結線は 14 中 2（AGT-05、AGT-SEC の失効側）。DevOps の BLD/DEP/INC は監査ログ 1 行を書いて終わる。PrjOps 6 エージェントはランタイム呼び出しゼロ |
| (2) 5 統合の E2E 成立性         | **部分成立** | Graph（Teams/Outlook）と GitHub 認証・webhook は実装として運用水準に近い。Claude Code の coding-task は実行すれば確実に失敗。**Plane は実装ゼロ**  |
| (3) デプロイ可能性              | **不成立**   | deploy workflow・Bicep・`infra/` がいずれも 0 件。deploy-prod.yml は echo のみで配置場所も未解決。バックアップ方式は未決定                         |

先行する `.orchestration/audit/production_readiness_gap_audit.md` の NO-GO 判定と結論は一致する。ただし**内訳は大きく変化しており**、当時の Critical の多くは解消済みで、残存リスクは「承認フロー」「実行結線」「デプロイ層」の 3 点に集約された。

## 所見件数

| 章     | 領域                 | Critical | High   | Medium | Low/情報 | 計     |
| ------ | -------------------- | -------- | ------ | ------ | -------- | ------ |
| 01     | 実行時結線 ADV-WIR   | 2        | 7      | 3      | 1        | 13     |
| 02     | 統合シーム ADV-INT   | 1        | 6      | 8      | 5        | 20     |
| 03     | セキュリティ ADV-SEC | 0        | 2      | 7      | 4        | 13     |
| 04     | 検証基盤 ADV-VER     | 0        | 4      | 7      | 2        | 13     |
| 05     | 運用即応性 ADV-OPS   | 2        | 2      | 5      | 3        | 12     |
| 06     | 動的検証 ADV-DYN     | 0        | 0      | 1      | 0        | 1      |
| 07     | ブランチ差分 ADV-DLT | 0        | 0      | 4      | 5        | 9      |
| **計** |                      | **5**    | **21** | **35** | **20**   | **81** |

## Critical 5 件

1. **ADV-WIR-001** DevOps イベントハンドラ（AGT_BLD/DEP/INC）が監査追記のみでエージェント関数を呼ばない — **動的検証で再現済み**（正署名 webhook → 202 → 監査 2 行のみ、外部 API 呼び出しゼロ）
2. **ADV-WIR-002** PrjOps AGT-01/02/03/04/06/07 のランタイム呼び出しがゼロ。特に **AGT-07（配信前検証）未結線**は外部配信を伴う設計として最も重い
3. **ADV-INT-080** Plane はランタイム実装ゼロ（`grep -ril plane packages/` = 0 件）。ADR-0019 は採択済みだが到達点は Phase A の一部
4. **ADV-OPS-001** デプロイ経路・IaC が完全に不在（deploy workflow 0 件、`*.bicep` 0 件、`infra/` なし）
5. **ADV-OPS-002** deploy-prod.yml が echo プレースホルダのまま・配置場所未解決 → 自動も手動もデプロイ経路が動かない

加えて、**旧監査の Critical `AUD-OPM-001`（変更承認カードに決定エンドポイントがない）が 2026-07-11 から一切変化なく残存**している（08 章）。送信側の AGT_CHG は完備だが、受け側のルートも DB テーブルも存在しない。

## 何が本当に良くなったか

この 190 コミットで解消された旧 Critical/High（08 章に証拠付き一覧）:

- GitHub App 認証の実装（RS256 JWT + installation token キャッシュ + single-flight）
- PrjOps ダッシュボードの本番データ源（commit SHA + content SHA256 で pin）
- `SAMPLE_STAKEHOLDERS` の完全排除と YAML マスタ + fail-closed 化
- web の per-request `pg.Pool` → singleton 化
- Node 22 / pnpm 11 / Anthropic SDK 更新
- GitHub クライアントへの retry/backoff 適用（`fetchPolicy.ts` として Graph と共通化）
- Graph subscription の自動復旧（renew 失敗 → polling 遷移 → 再作成、lifecycle 3 イベント処理）
- audit_log 追記専用の DB トリガによる無条件強制
- Dockerfile の multi-stage 化・非 root・HEALTHCHECK・ソース混入のビルド時 assert
- CI への lint / format / `pnpm audit` 追加、web テストの CI 実行
- claudeAgentClient・AGT-02/03/04 のカバレッジ 0〜6% → 100%
- Excel 取込の認証付き UI 化
- `.env.example` の整備（45 変数）

**動的検証で新たに実証できた良好な挙動**（06 章）:

- 空 env で `E-CFG01` fail-fast（必須 10 変数を列挙、秘密の非露出）
- スキーマ無し DB では**健全を装わず fatal 起動失敗**する
- 無署名 webhook を 401 で拒否、正署名は 202 + dedupe_key 記録
- app_role による audit_log の UPDATE/DELETE 拒否を実 DB で確認
- **`verification/run_db_integration.sh` の初の実成功**（過去の唯一の記録は Docker 不在で BLOCKED）

## 残存リスクの構造

旧監査は「規約文書は一流だが、規約を機械が強制する層が一段欠けている」と表現した。**強制層は明確に厚くなった。** 現時点の正確な描写は次の 3 つである。

1. **「部品はあるが配線がない」** — エージェント実装・テストは充実しているのに、常駐サーバから呼ばれない。テストが green でも実行到達性の証明にならないため、CI の green がこの欠落を隠す（01 章 × 04 章 ADV-VER-003 の合成）。
2. **「縮退が積み重なっても健全に見える」** — `missing config = disabled + audited` は原則として正しいが、12 箇所の縮退がすべて発動した最小構成でも `/healthz` `/readyz` は 200 を返す。無効化はメトリクス化されておらず、外形検知は任意設定の `HEARTBEAT_URL` 一本（02 章 ADV-INT-052、動的検証で実証）。
3. **「載せる場所が決まっていない」** — ADR-0016 で Azure Container Apps を採択して 3 週間経つが、Bicep も release workflow も 1 ファイルもない。バックアップ方式は `TBD(HUMAN)` のまま、5 年保持の監査ログに物理的裏付けがない（05 章）。

## 是正の推奨順序

**第 1 群（go-live 前提条件、これがなければ他は無意味）**

1. ADV-OPS-001 / 002 — デプロイ経路と IaC の実装
2. ADV-OPS-004 — バックアップ方式の HUMAN 裁定 + リストア演習 1 回
3. AUD-OPM-001 / T-P0-13・14 — 承認判断エンドポイントと配信前承認ゲート

**第 2 群（中心価値の成立）** 4. ADV-WIR-001 — DevOps 3 エージェントの結線 5. ADV-WIR-002 のうち **AGT-07 配信前検証**を配信経路の必須ゲートに 6. ADV-WIR-009 — JIT 権限の付与側結線（現状は失効ループが空回り）7. ADV-INT-002 — coding-task の CLI インストールと実行検証

**第 3 群（小工数で効果が大きいもの）** 8. ADV-SEC-001（`persist-credentials: false` + `--no-verify`）、ADV-SEC-002 / ADV-INT-003（鍵の分離）、ADV-SEC-004（events の sanitize）— いずれも工数 S 9. ADV-OPS-006 / ADV-DYN-001（METRICS_TOKEN 必須化）10. ADV-VER-009 / 010 — CI に Postgres service を足して実 DB テスト 7 件と `run_db_integration.sh` を有効化。**本レビューでこれらが実際に PASS することは確認済み**なので、配線するだけで塞げる

**Plane について**: ユーザーの趣旨には Plane が明示的に含まれるが、現状は「設計承認済み・実装未着手」である。plans/014 の Phase B（shadow observation）以降に着手する前に、ADR-0019 が定めた STOP ゲート（upstream issue #5757 の negative probe）と governance 承認証跡の欠落（ADV-INT-081）を先に解消する必要がある。

## 本レビューの限界

- Docker 不在のため `docker build` は未実施（06 章 D6 = BLOCKED）。Dockerfile の評価は静的検分による。
- 外部 API（GitHub / Graph / Anthropic 本番）は方針として一切呼んでいない。実テナントでの Teams app-only 投稿可否（ADV-INT-053）など、実環境でしか判定できない項目は BLOCKED のまま。
- 元仕様文書（REQ/SPEC-INT/AC の原文）との文言突合は行っていない。01 章の判定はコード上の到達可能性に基づく。
- 旧監査 68 所見のうち再検証したのは Critical 6 + High サンプル 8 + P0 14 件。Medium/Low は対象外。
- **撤回した所見が 1 件ある**: ADV-VER-013（AGENTS.md のツールバージョン不一致）は、対象コミットではなく古いローカルブランチの版を読んだことによる誤りで、PR レビューでの指摘を受けて 04 章で撤回した。有効な所見は 80 件。
- **是正作業中に 2 件を追加した**: ADV-VER-014（正本 PRD にしかない受入条件が機械検証の外にある）と ADV-VER-015（実在しない ID を引く根拠ヘッダ）。いずれも本レビューが見落としたもので、09 章に記録した。本体の判定は変えない。所見は計 82 件。

## 構成

| ファイル                       | 内容                                                 |
| ------------------------------ | ---------------------------------------------------- |
| 00-summary.md                  | 本書                                                 |
| 01-runtime-wiring.md           | 意図 vs 実行時結線（ADV-WIR、14 エージェント結線表） |
| 02-integration-seams.md        | GitHub / Claude / Teams / Outlook / Plane（ADV-INT） |
| 03-security-governance.md      | サニタイズ・監査・権限・秘密（ADV-SEC）              |
| 04-verification-infra.md       | CI・トレーサビリティ・カバレッジ（ADV-VER）          |
| 05-ops-readiness.md            | デプロイ・復旧・監視・バックアップ（ADV-OPS）        |
| 06-dynamic-verification-log.md | D1–D8 の期待 vs 実測、BLOCKED 一覧（ADV-DYN）        |
| 07-branch-delta.md             | agent/T-P0-04 差分（ADV-DLT）                        |
| 08-prior-findings-status.md    | 旧 AUD-* クロスリファレンス、P0 反映状況             |
| 09-addendum-2026-08-07.md      | 是正作業中に判明した事実（本体は書き換えない）       |
