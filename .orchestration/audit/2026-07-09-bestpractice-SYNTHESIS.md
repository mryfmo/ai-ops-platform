# ベストプラクティス総合ギャップ分析 — 統合サマリ (2026-07-09)

対象 agent/T21(スタック先端、全機能+敵対的レビュー是正込み)。4 領域の並列調査(一次情報)+ 現状監査を統合。
詳細: bestpractice-A-ops.md / bestpractice-BC.md / bestpractice-D-metrics.md。

## 全体像: 「機能は揃い、非機能とメトリクス正しさに体系的ギャップ」

T05-T21 で機能実装と敵対的レビュー(バグ)は完了。今回のベストプラクティス比較は**別軸** — 「本番運用グレードの非機能要件」と「メトリクスの方法論的正しさ」で、確認型でも敵対的レビューでも出ない層。総計 CRITICAL 1 / HIGH 12 / MED 30+ / LOW 多数。

## 是正の優先度(領域横断、深刻度順)

### 本番前ブロッカー(CRITICAL/HIGH)

**ガバナンス**
- [B-1.1 CRITICAL] CODEOWNERS が @OWNER プレースホルダ → 人間マージ統制が不在
- [B-1.3 HIGH] AI PR を GITHUB_TOKEN で作成 → CI が AI PR で起動せず必須チェック無効
- [B-4.1 HIGH] gitleaks-action@v2 が org 有償ライセンス必須 → 秘密スキャン無音失敗
- [B-2.1 HIGH] Actions が全て tag ピン(SHA 未ピン)
- [B-3.1 HIGH] Dependabot なし

**信頼性(A 領域 — 敵対的レビューも見逃した層)**
- [A-6 HIGH] イベントキューが失敗イベントを無音損失(delayed/dispatched が終端、再試行の実体なし、クラッシュ回収なし)
- [A-7 HIGH] webhook 冪等キー不在(GitHub/Graph 再配信で二重処理)
- [A-9 HIGH] フェイルセーフが何も止めない(L1b-1 裏付け)
- [A-11 HIGH] マイグレーション基盤なし、NOT VALID 制約が未 VALIDATE
- [A-2 HIGH] 可観測性ゼロ(OTel/metrics/spans なし)
- [A-13 HIGH] SLO/アラートなし

**LLM 運用**
- [C-model-1 HIGH] Opus エスカレーションに temperature 送信で常時 400=救済リトライが死んでいる ※要 API 仕様再確認
- [C-4 HIGH] thinking と temperature の競合(Sonnet5/Opus 移行で hard 400)
- [C-1 HIGH] eval ハーネスなし(真実性未検証、数値捏造を素通り)

**メトリクス正しさ**
- [D-C2 HIGH] DevOps「ベロシティ」が incident 数、PR throughput=0(完了作業でなく障害流入)
- [D-A1 HIGH] DORA 復旧時間が汎用 incident の平均(変更起因+中央値であるべき)

### 重要(MED、抜粋)

- 信頼性: Graph lifecycle 未処理、分散ロックなし、/readyz が failsafe 無視、シャットダウン drain 不備、プール timeout 不足、構造化ログなし
- ガバナンス: server の広域 GITHUB_TOKEN(`?? ""`)、environment/concurrency なし、report-generation の API キー env 欠落、pnpm audit なし、SBOM/provenance なし
- LLM: モデル一世代前(sonnet-4-6)、プロンプトキャッシュ/Batch API 未使用、pgCostGuard の TOCTOU+per-request 上限なし、refusal 未処理
- メトリクス: Seven Keys 質問票未配線で半分 grey、投資家 KPI の無加重企業横断合算、board-pack の target/variance/trend 不在、burndown が burn-up 誤称+負 clamp、総/残 分母不一致、カバレッジの hard gate 化、DORA ゼロデータが「エリート」表示

## 最良実装(参照パターンとして維持)

- graphClient の Retry-After+ジッタ backoff、config.ts の zod fail-fast、report_delivery_log PK 冪等(→ webhook ingest へ展開すべき)
- ViewSpec 限定・persona ゲートのツール(注入封じ込め)、read-only diff の三重防御、決定的メトリクス+LLM 文章限定
- Seven Keys のフレームワーク忠実度、RAG の色+形状+テキスト(色覚安全)
- coding-task.yml の注入衛生、report-generation のスキーマ検証済み LLM 出力、frozen-lockfile

## 是正のグルーピング案(実施はユーザー指示待ち)

- **G1 本番ゲート**: B-1.1/1.3/4.1/2.1/3.1(ガバナンス)+ A-9 failsafe 実効化
- **G2 ingest 信頼性**: A-6 キュー再試行/DLQ + A-7 冪等キー + A-8 Graph lifecycle
- **G3 データ健全性**: A-11 マイグレーション + プール timeout
- **G4 可観測性**: A-2 OTel + A-13 SLO + 構造化ログ
- **G5 LLM 正しさ**: C-model-1/C-4(パラメータ)+ C-1 eval + モデル移行
- **G6 メトリクス正しさ**: D-C2/D-A1(HIGH)+ Seven Keys 質問票 + 投資家 board-pack
