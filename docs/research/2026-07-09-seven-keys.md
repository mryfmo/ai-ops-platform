# 補完調査: Seven Keys to Success (2026-07-09)

出所: PwC Ascendant™ → IBM 買収(2002)で WWPMM に吸収、IBM 白書「Altering project history — Seven Keys to Success」(2004)。運用は**月次 PDCA + キー毎の RAG 評価**、direct controls(3,4,5)と indirect controls(1,2,6,7)に区分。**財務指標は遅行指標として意図的に除外**。一次資料は取得不能(secondary 再構成、7 キー名は独立 4 ソース以上で一致 = 高信頼、キー毎の healthy/unhealthy 基準は中信頼)。

## 7 キーの定義と RAG 基準(要約)

1. **Stakeholders are committed** — スポンサー可視・リソース投入。green: 経営スポンサー可視、変革管理投資 / red: スポンサー不在、抵抗
2. **Business benefits are realized** — 事業便益が明文化・測定・追跡。green: 実施理由が明確、便益の継続追跡 / red: 「なぜやるのか」不明
3. **Work and schedule are predictable** — 計画・見積・進捗が統制下。green: 「完了」の定義が全員一致、遅延は事前予測される / red: 完了基準なし、突然の遅延
4. **Scope is realistic and managed** — 境界定義と変更の交渉・文書化。green: 活発な issues log、書面合意 / red: issue がタブー、スコープ不明
5. **Team is high performing** — スキル・士気・協働。green: 士気良好、役割明確 / red: 緊張、離職
6. **Risks are mitigated** — リスクの体系的特定・検証・対処。green: 文書化された対応計画、test-it-first / red: 「リスク?何の?」
7. **Delivery organization benefits are realized** — 実施組織側の便益(スキル・評判・再利用)。green: 学習実感、良い評判 / red: 組織学習なし

## GitHub 信号マッピング

- **コード算出可能(強)**: キー 3(マイルストーン遅延、バーンダウン、見積 vs 実績)、キー 4(issue churn、期中スコープ追加)、キー 5(レビュー待ち時間、参加分散、コントリビューター離脱)
- **ハイブリッド**: キー 6(高重大度 issue の件数・経過、リスク台帳の鮮度、mitigation PR)
- **人間/LLM 構造化入力が主**: キー 1、キー 2、キー 7 — 既存の「数値はコード、LLM は文章スロット」設計と整合(構造化質問票で入力)

## 既存実装との差分(Phase I2 の要修正点)

`packages/prjops/src/lib/executiveSevenKeys.ts` は**独自の 5 指標であり正典と別物**:

- 現行: ポートフォリオ健康度 / 進捗達成率 / 高リスク課題数 / 予算消化率(常に null) / スケジュール遵守率 → 正典のキー 3・6 に部分対応するのみ
- **キー 1,2,4,5,7 が完全欠落**。予算消化率は正典が明示的に排除する財務指標
- 正典は「プロジェクト毎 × キー毎の RAG」であり、ポートフォリオ色分布ではない

## 注意

- 同名別物の罠: DAU/Gadeken「PM Leadership: Seven Keys to Success」(2005) は無関係
- キー毎基準の文言は IBM 系二次資料(SlideShare の IBM 講演資料が最詳)による代表的表現であり、逐語的正典ではない

## 主要ソース

- https://www.slideshare.net/slideshow/ibm-the-7-keys-to-success-momodar/16257762 (IBM 系、最詳)
- https://larion.com/ibms-seven-keys-success/
- https://www.linkedin.com/pulse/project-health-darryl-godfrey (出所系譜)
- https://managingglobalsourcing.blogspot.com/2011/03/ibms-seven-keys-of-success.html (IBM 2004 白書への言及、月次 RAG PDCA)
