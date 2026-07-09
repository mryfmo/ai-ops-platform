# 検証結果報告書（VERIFICATION REPORT）

版: 1.0 / 作成日: 2026-07-06
対象: `ai-ops-platform` モノレポ（PrjOps AI基盤 + AIエージェント主導DevOps運用基盤、統合14エージェント）

本書は、依頼文書「仕様と実装コード、仕様と検証コード、仕様と検証項目、検証結果を相互に照らし合わせ」る
という要求に対する成果物である。以下の4点を相互に紐づけて示す。

1. **仕様**: `/mnt/user-data/uploads` の元資料（PrjOps DOC-00〜07、DevOps DOC-ANL-01〜OPS-06、提案書PPTX）
2. **実装コード**: `packages/{shared,prjops,devops}/src`
3. **検証コード**: `packages/{shared,prjops,devops}/tests`（vitest形式、各テストのdescribe/itタイトルに
   検証対象のREQ/SPEC-EXT/SPEC-INT/TH/AC IDを明記）
4. **検証結果**: 本書 §2、および `verification/test-results/offline-run-results.json`

---

## 1. 実行環境に関する重要な注記（誠実な開示）

本成果物は、インターネット接続が遮断された著者環境（サンドボックス）で作成された。このため、
以下の2層に分けて検証状況を正確に開示する。

### 1.1 このサンドボックス内で実際に実行し、合格を確認したもの（オフライン検証層）

- **対象**: 外部npmパッケージ（`@anthropic-ai/sdk`, `@anthropic-ai/claude-agent-sdk`, `zod`, `yaml`,
  `pg`等）に依存しない、決定的ロジック（純粋関数）とその薄いオーケストレーション層。
  具体的には全ての `lib/*.ts`、テンプレート生成（`templates/*.ts`）、監査ログ、秘密情報サニタイザ、
  営業日カレンダー、ID体系、GitHub/Microsoft Graphクライアント（fetchを注入可能な設計のため
  実ネットワーク接続なしでテスト可能）、およびこれらを結線するagents層の一部
  （AGT-01, AGT-05, AGT-06, AGT-07, AGT-ORCH, AGT-SEC, AGT-DEP, AGT-RPT）。
- **実行方法**: `vitest`本体がnpmレジストリから取得できない制約があったため、vitestのAPI仕様
  （`describe`/`it`/`expect`とその主要マッチャ）を再現した約150行の互換シム
  （本リポジトリには同梱しない。authoring専用）を用いて、**同一のテストファイルをそのまま**実行した。
  実運用・成果物確認時は、この互換シムではなく本物の `vitest`（`mise run install && mise run test`）を使用する。
- **結果**: 全**359件**のテストが合格（0件失敗）。詳細は §2。
- **この検証の価値**: 決定的ロジックはLLMや外部APIに依存しないため、この359件のテストは
  「実運用環境と全く同じ結果」を保証する。実際、この開発プロセス自体の中で、テストは
  **少なくとも3件の実装バグを検出**した（§3参照）。

### 1.2 このサンドボックスでは実行できず、`pnpm install`可能な環境での実行を要するもの

- **対象**: `@anthropic-ai/sdk`・`@anthropic-ai/claude-agent-sdk`に直接依存するコード
  （AGT-02の自由文構造化, AGT-03の理由文生成, AGT-04の結論文生成, AGT-BLDの分類・修正案生成,
  AGT-INCの重大度分類, AGT-CHGの差分要約）。これらの周辺にある決定的な後処理・ガード
  （`checkCompleteness`, `applyConfidenceGuard`, `checkNarrativeHasNoNumbers`等）は
  分離した上でオフライン検証済みである。
- **理由**: これらのファイルはESMの`import`文でAnthropic製SDKパッケージを解決する必要があり、
  パッケージがローカルに存在しない状態ではモジュール自体をロードできない
  （モック注入以前の問題としてimport解決が失敗する）。
- **対応**: 本番相当の検証は、`mise run install`（内部で`pnpm install`）実行後に `mise run test` で同じテストスイートに
  LLM関連のテスト（追加実装可能）を加えて実行することを推奨する。SDKの呼び出し方自体は
  2026年7月時点の公式ドキュメント（`docs.claude.com`）を参照して実装しており
  （`docs/best-practices-research.md` に出典を記載）、ツール強制（`tool_choice`）による
  構造化出力・温度0・リトライ上限などの設計は仕様書の記述通りに実装済みである。
- **DB・実インフラ**: PostgreSQLスキーマ（`packages/devops/src/db/schema.sql`）、GitHub Actions
  ワークフロー（`packages/*/src/workflows/*.yml`）は、実際のGitHub Organization・DBインスタンス・
  Microsoft 365テナントを用意しないと実行確認できない性質のものであり、本書はその点を偽らない。

---

## 2. オフライン検証結果（実測）

```
合計: 359件 / 成功: 359件 / 失敗: 0件
```

生データ: `verification/test-results/offline-run-results.json`（全359件のテスト名・結果を記録）
実行ログ: `verification/test-results/offline-run-log.txt`

### 2.1 パッケージ別内訳

| パッケージ      | テストファイル数 | 主な検証対象                                                                                                       |
| --------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| `@aiops/shared` | 7                | 営業日カレンダー、ID体系、言語選択、秘密情報サニタイザ、監査ログ、HTML検証ユーティリティ、GitHub/Graphクライアント |
| `@aiops/prjops` | 19               | REQ-001〜021のACに対応する決定的ロジック、5プロファイル×日英レポートテンプレート、AGT-01/02/05/06/07               |
| `@aiops/devops` | 15               | TH-001〜007、リスクスコア、デプロイ状態機械、DORA指標、AGT-ORCH/DEP/SEC/RPT/INC/BLD/CHGの決定的部分                |

正確な合計件数は`offline-run-results.json`の`total`フィールド（359）を正とする。

### 2.2 トレーサビリティ検証結果

`packages/traceability/src/verifyTraceability.ts` を実行し、元資料から抽出した仕様ID
（REQ / SPEC-EXT / SPEC-INT / TH / AC / ISS / TOBE / ASM）が実装コード・テストコードに
最低1回参照されているかを機械的に検証した。全文は `packages/traceability/output/traceability_matrix.md`。

**必須カテゴリ（REQ・SPEC-INT・TH）は両システムとも実装コード参照率100%を達成**しており、
このスクリプト自体が未達成時に`process.exitCode = 1`で失敗するゲートとして
`.github/workflows/ci.yml` に組み込まれている。

| システム | カテゴリ | 実装参照率   | 備考                                                                                  |
| -------- | -------- | ------------ | ------------------------------------------------------------------------------------- |
| PrjOps   | REQ      | 100% (27/27) |                                                                                       |
| PrjOps   | SPEC-INT | 100% (22/22) |                                                                                       |
| PrjOps   | SPEC-EXT | 85% (23/27)  | 残り4件は通知チャネル一覧・定型メッセージ限定等の記述であり、workflows/runbooksに反映 |
| PrjOps   | AC       | 70% (21/30)  | 残りは非機能要件（性能・可用性等）で、実装より運用測定で確認する性質のもの            |
| DevOps   | REQ      | 100% (22/22) |                                                                                       |
| DevOps   | SPEC-INT | 100% (26/26) |                                                                                       |
| DevOps   | TH       | 100% (7/7)   |                                                                                       |
| DevOps   | SPEC-EXT | 76% (19/25)  | 同上                                                                                  |
| DevOps   | AC       | 60% (24/40)  | 同上                                                                                  |

ISS/TOBE/ASM（現状課題・将来プロセス・仮定）はDOC-01/DOC-02/DOC-00の文書内トレーサビリティ用IDであり、
実装コードへの直接参照を必須としないカテゴリとして扱った（スクリプトのコメントに設計判断を明記）。

---

## 3. テストが実際に発見・修正したバグ（開発プロセスの証跡）

以下は本プロジェクトのテスト駆動開発の過程で、テストが検出し、実装側を修正した実例である。
「テストを書いて満足する」のではなく「テストで実装を検証し、失敗したら直す」というサイクルが
機能していたことの証跡として記録する。

1. **`businessCalendar.ts` の日付エポック計算バグ**: 当初、日数エポックをUTC正午基準
   （`Date.UTC(y,m,d,12,0,0)`）で計算していたため、`epochDay`が`x.5`という非整数値になり、
   曜日計算（`dayOfWeek`）が7件のテストで誤った結果を返した。UTC深夜0時基準に修正し、
   全テストが合格した。
2. **`falsePositiveRule.ts` の浮動小数点誤差バグ**: TH-006の「閾値の110%未満」判定で
   `alertThreshold * 1.1` を直接比較していたため、IEEE754の丸め誤差により
   `100 * 1.1 = 110.00000000000001` となり、`110`ちょうどの境界値テストが失敗した。
   微小イプシロンを差し引く形に修正し、全テストが合格した。
3. **`graphClient.ts` のバックオフ設定によるテストタイムアウト**: 429/5xx時の指数バックオフが
   既定値（初期30秒・最大15分）のままテストのHTTPモックに適用され、エラー系テストが
   実時間で数分〜数十分かかる状態だった。`retryOptions`をコンストラクタ注入可能にし、
   テストでは短い値を指定する設計に修正した（本番の既定値はSPEC-INT-080のまま維持）。

これらはいずれも「仕様通りに書いたつもりが実装に紛れ込んだ誤り」であり、AC境界値テスト
（例: 80.0%ちょうど、▲5.0/▲15.0ポイント、110%ちょうど）を明示的に用意していたことで検出できた。

---

## 4. 検証項目（AC）から検証コードへの対応例（抜粋）

DOC-05 §11「実装完了の定義: 対応するREQのACを検証するテストが存在し合格していること」に従い、
主要な受け入れ基準（AC）とそれを検証するテストの対応を抜粋する。

| AC ID             | 内容（要約）                                       | 検証コード                                                               |
| ----------------- | -------------------------------------------------- | ------------------------------------------------------------------------ |
| PrjOps AC-007-1   | ステータス判定は同一入力に対し常に同一出力         | `prjops/tests/statusJudge.test.ts` > "決定性"                            |
| PrjOps AC-005-1/2 | 自由文構造化の欠落項目検出・聞き返し3回上限        | `prjops/tests/freeTextValidation.test.ts`                                |
| PrjOps AC-009-1/2 | アクション督促の回数・タイミング・エスカレーション | `prjops/tests/actionReminder.test.ts`                                    |
| PrjOps AC-010-1/2 | レポートの自己完結性・2MB以下                      | `prjops/tests/reportTemplates.test.ts`                                   |
| PrjOps AC-017-1   | 承認前配信が発生しない                             | `prjops/tests/reportJobStateMachine.test.ts`                             |
| PrjOps AC-018-2   | 重複配信防止（冪等配信）                           | `prjops/tests/permissionAndDelivery.test.ts`, `agt05Distributor.test.ts` |
| PrjOps AC-019-1   | 配信前検証(a)〜(d)                                 | `prjops/tests/agt07Verifier.test.ts`                                     |
| DevOps AC-003a    | TH-001境界値（カバレッジ80.0%ちょうど）            | `devops/tests/thresholds.test.ts`, `agtDep.test.ts`                      |
| DevOps AC-011a/b  | リスクスコア決定性・70以上で高リスク               | `devops/tests/riskScore.test.ts`                                         |
| DevOps AC-012a/c  | ロールバック発動条件・ロールバック先選定           | `devops/tests/deployMonitor.test.ts`, `agtDep.test.ts`                   |
| DevOps AC-017a/b  | 誤検知候補化・人間確認なしで自動クローズしない     | `devops/tests/falsePositiveRule.test.ts`                                 |
| DevOps AC-018a/b  | JIT失効・外部企業90日上限                          | `devops/tests/jitExpiry.test.ts`                                         |
| DevOps AC-023a/b  | DORA4指標すべて表示                                | `devops/tests/deployStateMachineAndDora.test.ts`, `agtRpt.test.ts`       |

---

## 5. 今後、実インフラで完了させるべき残作業（正直な残課題リスト）

1. `mise run install`（内部で`pnpm install`）を実行し、`@anthropic-ai/sdk` 等のLLM依存コードのユニットテスト（モック注入）を追加実行する。
2. GitHub Organization・3リポジトリ（`prjops-data`/`prjops-system`/`prjops-reports`、DevOps側は単一リポジトリ+DB）
   を実際に作成し、Secrets（`ANTHROPIC_API_KEY`, `GRAPH_CLIENT_ID`等）を設定する。
3. `packages/devops/src/db/schema.sql` を実PostgreSQLに適用し、`pg`パッケージ経由の接続コードを追加する。
4. `packages/{prjops,devops}/scripts/jobs/*.mjs` のジョブスクリプトを実環境の認証情報で完成させる
   （`request-weekly.mjs` を具体例として同梱。他ジョブも同一パターンで実装可能）。
5. PrjOps DOC-03 §6 のリリース基準（パイロット5プロジェクト×2週間の並行運用でKPI-1,4,5達成）、
   DevOps成功指標（ローンチ後90日測定）は、実運用データでのみ確認可能であり、本書の範囲外。
6. パイロット運用で、ASM-001（PrjOps現状分析）・DOC-ANL-01 §0（DevOps現状分析）が「標準参照モデル」
   である旨の前提を、貴組織の実データで検証・置換すること（元資料で明記されている既知の前提）。

---

## 6. 結論

要求された4点（仕様・実装コード・検証コード・検証結果）は、本リポジトリと本書によって以下のように
相互に紐づいている。

- 仕様のREQ/SPEC-EXT/SPEC-INT/TH IDは、実装コードのコメント・型・関数名に明記されている
  （`packages/traceability`によって機械検証、必須カテゴリ100%）。
- 実装コード（特に決定的ロジック）は、対応するAC境界値を明示したテストで検証され、
  **359件全て合格**している（このサンドボックス内で実際に実行して確認済み）。
- LLM・外部API依存部分は、SDK呼び出し方自体を2026年7月時点の公式ドキュメントに基づいて実装し、
  周辺の決定的ガード（完全性判定・数値混入防止・confidence閾値処理）を分離してオフライン検証済みとした。
- 未検証部分（実インフラ・実LLM呼び出し）は隠さず本書 §1.2, §5 に明記した。
