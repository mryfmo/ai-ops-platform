# T30: 製品運用レベル到達ギャップの全量抽出監査(read-only)

## 目的

ai-ops-platform は現状「実際に運用できるレベル」の仕様・ドキュメント・実装コード・検証コードになっていない(ユーザー判断)。製品レベル(実運用投入可能)に到達するために必要な箇所を**全量**抽出する。これは読み取り専用の監査タスクであり、修正は行わない(修正は後続タスクで個別に起票する)。

## スコープ: 4 面 × 6 レンズ

4 面(相互突合すること — 面単独の精読では足りない):

1. **仕様** — docs/spec、docs/adr、spec-ids(prjops/devops)。仕様自体の欠落・曖昧・矛盾・実装と乖離した記述
2. **ドキュメント** — docs/guide、docs/reference、runbooks/、README、AGENTS.md。運用者/導入者が実際に従える水準か
3. **実装コード** — packages/*(shared/prjops/devops/server/web/traceability)。仕様にあるが未実装、実装はあるがスタブ・TODO・fail-open・ハードコード
4. **検証コード** — packages/*/tests、verification/、CI(.github/workflows)。実装はあるが検証されていない、検証がモック止まりで実環境未実証

6 レンズ(各面に適用):

- **運用性**: デプロイ手順、環境構築、設定管理、シークレット供給(AIOPS_PR_TOKEN 等)、DB マイグレーション運用、バックアップ/リストア、アップグレード手順
- **信頼性**: 障害モード網羅、リトライ/冪等性、fail-closed 徹底、監視/アラート/SLO の実配線、graceful shutdown、データ整合性
- **セキュリティ**: 認証/認可の全エンドポイント網羅、秘密情報 3 層サニタイズの実効性、監査ログ追記専用の強制、権限フィルタのバイパス経路
- **仕様完全性**: REQ/SPEC/TH/AC の網羅性、traceability の実カバレッジ(ID が振られているだけで中身が薄い箇所)、エッジケース仕様の欠落
- **検証完全性**: 実環境 E2E(runbooks/e2e-real-environment.md — ローカルは PostgreSQL/Docker/ANTHROPIC_API_KEY なし)の未実施範囲、verified-integration / requires-real-env の正直な区分、負荷/性能検証の有無
- **ドキュメント実効性**: runbook が実際に実行可能か(コマンド・前提の欠落)、オンボーディング可能か、go-live チェックリストの有無

## 既知シード(検証はするが、これに限定するな — 独立に全量発見すること)

- L1b-1 フェイルセーフ停止配線: 未実装・文書化のみ
- T14 実環境 E2E: 未実施(runbooks/e2e-real-environment.md 参照)
- AGENTS.md 記載の go-live 前提: ブランチ保護 CODEOWNERS 必須化確認、AIOPS_PR_TOKEN 未設定運用の禁止
- verification/VERIFICATION_REPORT.md の検証状況区分

## 方法(否定的レビュー)

- 「動く」ではなく「運用に耐える」を基準に反証を試みる。grep で TODO/FIXME/stub/mock/hardcode/placeholder/not implemented を全量洗い、各所見に実ファイル:行の証跡を付ける
- 仕様 ⇔ 実装 ⇔ テスト ⇔ ドキュメントの 4 面突合で「片面にしか存在しないもの」を機械的に列挙する
- mise run ci が green であることは前提(= green でも残るギャップを探す)。CI 実行はしてよい
- 書かれていないこと(不作為)を積極的に疑う: エラー時の運用手順、データ破損時の復旧、鍵ローテーション、依存更新方針、容量/コスト管理

## 成果物

正本: `.orchestration/audit/production_readiness_gap_audit.md`

- 所見は `PRG-001` から連番。各所見: 面(仕様/文書/実装/検証)、レンズ、重大度(CRITICAL/HIGH/MED/LOW)、証跡(file:line または「不存在」の確認方法)、製品レベルに必要な理由、推奨対処(後続タスク化できる粒度)
- 冒頭にサマリ表(重大度 × 面のマトリクスと件数)
- 末尾に推奨対処の依存関係と優先順位付き実施順序案

## 制約

- **read-only**: packages/、docs/、runbooks/、.github/ 等リポジトリ本体への変更禁止。書き込みは .orchestration/ 配下の成果物のみ
- forbidden_actions: code-edits、push、merge、dependency-changes、real-llm-calls、git-checkout/reset(作業ツリーを動かさない)
- CI(mise run ci)や個別テストの**実行**は許可(証跡取得のため)。ただし修正はしない
- 網羅を優先しつつ、重大度判定は保守的に(疑わしきは HIGH 寄りでなく証跡の強さで判定)

## revise 第 1 巡(orchestrator 独立突合による差し戻し)

orchestrator の独立調査との突合で以下の不作為を確認した。監査正本に追記し、サマリ表・4×6 マトリクス・依存順序を更新すること。

**MUST:**

1. **欠落所見の追加**: `packages/devops/src/workflows/on-workflow-failure-triage.yml:19` が `node packages/devops/scripts/jobs/on-build-failure.mjs` を実行するが、`packages/devops/scripts/jobs/` には README.md しか存在しない(orchestrator 実測確認済み)。この workflow は配布されても初回実行で必ず失敗する。Implementation/Operability、重大度は HIGH 相当(PRG-003/006 とは別個の所見として起番)。周辺の同種問題(他の workflow が参照する非存在スクリプト/アクション)がないか同時に掃くこと。

**SHOULD:**

2. `packages/devops/src/lib/incidentBurndown.ts:10` の「暫定実装であり本来のチケット管理システムとの連携は…」を所見または既存所見(PRG-002 等)の証跡として明記
3. `.env.example` が存在しない(オペレータが env 変数一式を逆引きするしかない)ことを PRG-018 または PRG-032 の証跡に明示

## 完了条件

- 4 面 × 6 レンズすべてに対し「所見あり」または「確認済み・ギャップなし(確認方法付き)」が明記されている
- 既知シード 4 項目すべてに言及がある
- AGMSG-RESULT v1 送信(artifacts 5 点 + 正本パスを含める)
