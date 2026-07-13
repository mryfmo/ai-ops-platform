# 00. 製品化準備状況監査 総括・是正ロードマップ

- 監査日: 2026-07-11
- 監査対象コミット: `39b95944e9f17dffce500c21f40989f6fa86092d`（branch: agent/005-microsoft-graph）
- 監査方法: 全パッケージのコード精査（Critical/High の根拠は file:line を個別に実証）、公式ドキュメント・2026-07-11 時点の最新情報との突合（全出典 URL に確認日を付記）、`pnpm audit` / `pnpm outdated` / GitHub API による実測。
- 構成: 本総括 + 領域別レポート 8 本（01〜08）。指摘は `AUD-<領域>-NNN` で一意に識別。08（統合運用モデル）は同日の追加監査で、Outlook/Teams + Claude Code + GitHub + Excel-Import + Web の構成における PrjOps + DevOps の**運用**を対象とする。全指摘の是正手順は [09-remediation-plan](09-remediation-plan.md)（後工程実行エージェント向け作業計画書）に単一タスク粒度で定義済み。

## 1. 総合評価

**現状は「良質な設計と厚い単体テストを持つ、本番投入前のシステム」であり、実運用可能な製品レベルには達していない。**

設計原則（純粋関数と結線層の分離、LLM の役割限定、追記専用監査ログ、注入可能クライアント）は一貫して守られており、webhook 署名検証・graceful shutdown・コストガード等は公式ベストプラクティスに合致する。一方で、(a) 中核機能のデータ供給・認証がスタブ/フィクスチャのまま、(b) 負荷・障害下で確実に壊れる欠陥（接続リーク、タイムアウト不在）、(c) EOL ランタイム、(d) ガバナンス前提（branch protection）が現行 GitHub プランで実現不能、という本番ブロッカーが残る。

**指摘総数: 68 件（Critical 6 / High 21 / Medium 30 / Low 11）**

| 領域               | レポート                                    | Critical | High | Medium | Low | 計  |
| ------------------ | ------------------------------------------- | -------- | ---- | ------ | --- | --- |
| 仕様乖離・未実装   | [01-unimplemented](01-unimplemented.md)     | 3        | 1    | 3      | 2   | 9   |
| 外部連携・耐障害性 | [02-reliability](02-reliability.md)         | 1        | 2    | 3      | 1   | 7   |
| セキュリティ       | [03-security](03-security.md)               | 0        | 4    | 4      | 2   | 10  |
| テスト・検証       | [04-verification](04-verification.md)       | 0        | 3    | 3      | 1   | 7   |
| トレーサビリティ   | [05-traceability](05-traceability.md)       | 0        | 2    | 2      | 1   | 5   |
| 運用・デプロイ     | [06-operations](06-operations.md)           | 0        | 2    | 4      | 1   | 7   |
| 依存・技術鮮度     | [07-dependencies](07-dependencies.md)       | 1        | 2    | 4      | 1   | 8   |
| 統合運用モデル     | [08-operating-model](08-operating-model.md) | 1        | 5    | 7      | 2   | 15  |

Severity 定義 — **Critical**: 本番投入ブロッカー（動かない・データ損失/漏洩・EOL 基盤）。**High**: 本番で高確率に障害・インシデント化。**Medium**: 障害の検知・復旧・変更を遅らせる。**Low**: ベストプラクティスからの軽微な逸脱。工数 — S: ≤1 人日 / M: 2–5 人日 / L: >5 人日または ADR 級の意思決定を要する。

## 2. Critical / High 一覧

### Critical（6 件）

| ID          | 指摘                                                                       | 工数 |
| ----------- | -------------------------------------------------------------------------- | ---- |
| AUD-IMP-001 | GitHub App 認証が `GITHUB_TOKEN ?? ""` のスタブ（server/src/index.ts:187） | M    |
| AUD-IMP-002 | PrjOps ダッシュボードのデータ供給が空の InMemory フィクスチャ              | L    |
| AUD-IMP-003 | Teams ペルソナ解決がハードコードのサンプル人物（SAMPLE_STAKEHOLDERS）      | M    |
| AUD-REL-001 | web 全 7 API ルートがリクエスト毎に pg.Pool を生成し解放しない → 接続枯渇  | S    |
| AUD-DEP-001 | Node.js 20 が 2026-04-30 で EOL（ランタイム・Docker ベースとも）           | M    |
| AUD-OPM-001 | 変更承認カードの意思決定エンドポイントが存在しない（承認フローが完結不能） | M    |

### High（21 件）

| ID          | 指摘                                                                                       | 工数 |
| ----------- | ------------------------------------------------------------------------------------------ | ---- |
| AUD-IMP-004 | PrjOps スケジューラ/ワークフロー未出荷（週次自動運転が成立しない）                         | L    |
| AUD-REL-002 | 全外部クライアントにリクエストタイムアウトなし（AbortController 0 件）                     | M    |
| AUD-REL-003 | GitHubClient にリトライ/バックオフなし — **SPEC-INT-080 違反**                             | M    |
| AUD-SEC-001 | branch protection が現行 GitHub プランで利用不可（ADR-0006 の強制力不在、gh API 403 実測） | S    |
| AUD-SEC-002 | 全 HTTP エンドポイントにレート制限なし                                                     | M    |
| AUD-SEC-003 | Docker イメージが root 実行・全ソース・devDeps 同梱                                        | S    |
| AUD-SEC-004 | audit_log の REVOKE が app_role 不在時に silent no-op                                      | S    |
| AUD-VER-001 | claudeAgentClient の read-only 強制が実質未テスト（カバレッジ 5.88%）                      | M    |
| AUD-VER-002 | LLM 経路エージェント AGT-02/03/04 がカバレッジ 0%                                          | M    |
| AUD-VER-003 | 実環境 E2E（実 DB・LLM・Graph/Teams・Excel 取込）未実施                                    | L    |
| AUD-TRC-001 | 旧仕様 ID（REQ-001..035 等）の正本定義がリポジトリ外で参照不能                             | M    |
| AUD-TRC-002 | トレーサビリティ検証が substring 一致のみ（仕様違反とゲート通過が両立する実例あり）        | M    |
| AUD-OPS-001 | バックアップ/PITR/リストア手順なし（監査ログ 5 年保持と矛盾）                              | M    |
| AUD-OPS-002 | SLO 3 件に対しアラートルール実体 0 件                                                      | S    |
| AUD-DEP-002 | pnpm 9 が EOL                                                                              | S    |
| AUD-DEP-003 | Anthropic SDK 群が大幅陳腐化（0.32.1→0.111.0 / 0.1.77→0.3.207）                            | M    |
| AUD-OPM-002 | 「非熟練者向け」Excel 取込が実運用ではエンジニア専用（HMAC 未文書化・UI なし）             | M    |
| AUD-OPM-003 | コーディングエージェント実行部が未検証かつガード不足のまま                                 | M    |
| AUD-OPM-004 | investor-quarterly の生成・配信ケイデンスが未実装（ILPA 期限を運用不能）                   | M    |
| AUD-OPM-005 | LLM ナラティブ入り報告の対外配信前に人間承認ゲートがない                                   | M    |
| AUD-OPM-006 | Teams 本番導入の前提（app-only 投稿・protected API・手動手順）が未検証                     | M    |

## 3. 是正ロードマップ

順序は工数ではなく**依存関係と爆発半径**で決定。P0 完了が「本番投入可能」、P1 完了が「安心して運用可能」、P2 完了が「持続的に維持可能」の状態に対応する。

### P0 — 本番投入前必須（すべての Critical + 直結する High）

| 順  | 対応                                                                                     | 対象 ID              | 工数 |
| --- | ---------------------------------------------------------------------------------------- | -------------------- | ---- |
| 1   | web の DB プールをシングルトン化（最小差分・全機能の前提）                               | AUD-REL-001          | S    |
| 2   | Node 22 / pnpm 10 へ更新（.mise.toml・Dockerfile・CI・AGENTS.md 同一 PR）                | AUD-DEP-001, 002     | M    |
| 3   | Docker ハードニング（非 root・本番依存のみ・HEALTHCHECK）— 2 と同時実施が効率的          | AUD-SEC-003          | S    |
| 4   | GitHub App installation token 実装 + GITHUB_TOKEN の config 統合                         | AUD-IMP-001, SEC-009 | M    |
| 5   | SAMPLE_STAKEHOLDERS 排除（マスタ未設定時は disabled+audited）                            | AUD-IMP-003          | M    |
| 6   | audit_log の append-only を起動時検証 + 例外トリガで無条件強制                           | AUD-SEC-004          | S    |
| 7   | 全クライアントへタイムアウト注入 + GitHubClient へ fetchWithBackoff 横展開               | AUD-REL-002, 003     | M    |
| 8   | GitHub プラン変更 or org 移管 → branch protection / CODEOWNERS 必須化を実際に有効化      | AUD-SEC-001          | S    |
| 9   | バックアップ方式の決定（ADR）+ アラートルールのファイル化と配線                          | AUD-OPS-001, 002     | M    |
| 10  | PrjOps データ供給・ステークホルダーマスタの本実装                                        | AUD-IMP-002          | L    |
| 11  | PrjOps 週次ジョブを server スケジューラへ結線                                            | AUD-IMP-004          | L    |
| 12  | 実環境 E2E チェックリスト 1 周（リストア演習・Teams 前提検証込み）→ verification/ に記録 | AUD-VER-003, OPM-006 | L    |
| 13  | 変更承認エンドポイント実装（coding-task confirm と同型の HMAC 承認ページ）               | AUD-OPM-001          | M    |
| 14  | 対外レポート配信前の記名承認ゲート（13 の承認ページ基盤を再利用）                        | AUD-OPM-005          | M    |

### P1 — 投入後 30 日以内

- 安全装置のテスト整備: claudeAgentClient の deny 検証、AGT-02/03/04 のモック結線テスト（AUD-VER-001, 002）— **SDK 更新の前提**
- Anthropic SDK 群更新 → モデル ID の config 化と Sonnet 5 移行評価（AUD-DEP-003, 006）
- CI 強化: lint/format 追加、pnpm audit 追加、既知脆弱性 4 件の更新（AUD-VER-005, AUD-DEP-004）
- 旧仕様 ID のカタログ移植 + トレーサビリティの実効性改善（AUD-TRC-001, 002）
- セキュリティヘッダ/CSP、/metrics 保護、レート制限方針の明文化（AUD-SEC-002, 005, 006）
- .env.example 生成、デプロイ基盤の ADR 決定とイメージ発行パイプライン（AUD-OPS-003, 004）
- 脅威モデル文書の新設（OWASP LLM Top 10 v2025 × 全 LLM 経路の対応表）（AUD-SEC-007）
- 運用モデル整備（第一弾）: Excel 取込の正確な手順文書化 → UI 化、investor-quarterly ケイデンス結線、coding-agent 実行部の検証とガード追加（allowedTools/max-turns/timeout）、確認トークンの TTL 化（AUD-OPM-002, 003, 004, 007）
- Mail.Send の Exchange RBAC for Applications によるテナント側スコープ設定（AUD-OPM-008）

### P2 — 90 日以内

- マルチペルソナ対応・AGT-04 プロファイル横断化・週次デルタ実装（AUD-IMP-005, 006, 007）
- prompt caching 導入・価格表の設定化・JST 計算集約（AUD-REL-004, 006, 007）
- vitest 3→4 / zod 4 段階更新、exceljs の ADR-0008 追記と再評価サイクル（AUD-DEP-005, 007, 008）
- テスト側トレーサビリティのゲート化・AC ゲート追加・matrix 自動生成（AUD-TRC-003, 004, 005）
- 負荷測定（AC-018-1 等の数値受入）・VERIFICATION_REPORT の矛盾解消（AUD-VER-004, 006, 007）
- secretSanitizer 拡張点・gitleaks pre-commit・コンテナ分離検討・シークレットローテーション手順（AUD-SEC-008, 010, AUD-OPS-005, 006）
- パイロット運用（5 プロジェクト × 2 週間）開始 → リリース基準の充足記録（AUD-OPS-007）
- 運用モデル整備（第二弾）: 配信 heartbeat/DLQ 方針、recipients 管理の同期ジョブと runbook、Excel の EUC 統制（版数・競合検出）、レポート保持/不変アーカイブ規定、RACI と pmo_operator の実体マッピング、Outlook 互換確認、テンプレート配布の認証下移設（AUD-OPM-009〜015）

## 4. 横断的な所見（個別指摘に還元されない構造的問題）

1. **「宣言と強制のギャップ」が反復パターン**: Definition of Done はローカルの mise run ci だが CI は lint/format を走らせない。ADR-0006 は人間レビュー必須だが branch protection は設定不能。SPEC-INT-080 はコメント出現でゲートを通るが実装がない。append-only は app_role が居るときだけ強制される。— 規約文書は一流だが、規約を**機械が強制する層**が一段欠けている。AI エージェントが開発主体である本プロジェクトでは、この層の欠落は通常より高くつく（エージェントは「書いてあるが強制されない規約」を守る保証がない）。
2. **安全装置ほどテストが薄い逆転**: 純粋関数（低リスク）は 90-100% だが、claudeAgentClient の書込防止（最高リスク）は 5.88%。カバレッジの配分がリスクと逆相関している。
3. **正本のリポジトリ外流出**: 旧仕様 ID の定義が authoring 環境にしか存在せず、トレーサビリティ規律が「文字列出現チェック」に空洞化する根因になっている。
4. **良い先例は既にリポジトリ内にある**: fetchWithBackoff（Graph）、server の pool 設定、ADR-0014 の disabled+audited 原則、spec-id-catalog の新 ID 形式 — P0/P1 の多くは新規発明ではなく**既存の良い実装の横展開**で解消できる。

## 5. 監査の限界

- 実環境（実 DB・実 Graph/Teams・実 LLM）での動的検証は行っていない（静的精査 + 既存検証成果物 + 実測コマンドのみ）。
- カバレッジ数値は既存の検証成果物・探索結果に依拠した箇所がある（claudeAgentClient 5.88% 等はリポジトリの coverage 成果物由来）。
- 旧仕様 ID の原本文書が参照不能のため、「実装が旧仕様を満たすか」は原理的に検証できていない（AUD-TRC-001 そのものが本監査の制約でもある）。
- Web 由来の事実（EOL 日付・最新バージョン・CVE）は 2026-07-11 時点の確認であり、経時で陳腐化する。
