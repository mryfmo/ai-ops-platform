# ADR-0009: チャートライブラリとしてRecharts 3を採用する

## ステータス

採用

## コンテキスト

- `REQ-010 AC-010-1` は既存の手書きSVGチャート制約を前提にしているが、今後の週/月/四半期/半年/年切替、tooltip、軸、アクセシビリティ、RAG冗長表現を全て自前実装すると保守負担が大きい。
- `docs/research/2026-07-09-charts-and-design.md` は、Recharts 3.9.2がReact 19 peerDeps対応、活発メンテ、a11yデフォルト有効、Tailwind v4のCSS変数テーミングと整合、MITであることを確認している。
- 同調査は、Rechartsがclient-onlyであること、手書きSVG継続が唯一のゼロJS/RSC選択肢であることも確認している。
- 仕様変更手続きとして、`.github/ISSUE_TEMPLATE/spec-change.yml` に従い `REQ-010 AC-010-1` のspec-change issue（https://github.com/mryfmo/ai-ops-platform/issues/2）を起票した。正式承認は同issueで追跡し、本ADRは承認待ちの変更手続きに依存する。
- 予定仕様ID: PrjOps `SPEC-INT-064` / `AC-010-3`。`SPEC-INT` のspec-id登録は実装コード参照と同じPRへ送る。

## 決定

- 手書きSVG制約を緩和し、チャートライブラリとしてRecharts 3を採用する。
- Recharts利用箇所はNext.js client componentに限定する。サーバーコンポーネントから直接Rechartsを描画しない。
- 既存のバーンダウン/ドーナツ手書きSVGは段階的に移行する。バーンダウンはRechartsの折れ線・面・棒など期間比較に適した表現へ移す。
- ドーナツはNN/gの指針に照らして角度エンコードを避け、原則として横棒、積み上げ棒、テーブル、またはKPI表示に置換する。
- RAG表示は色だけに依存せず、ラベル、形状、パターンなど第2チャネルを併用する。
- KPI、表、チャートの数値はtabular figuresを使い、桁の揃いを優先する。

## 根拠

- Recharts 3は、React 19/Next 15前提で現実的に採用できる候補の中で、アクセシビリティ、メンテナンス状況、Tailwind v4との整合のバランスが最も良い。
- visxは軽量だが、軸、tooltip、a11yを自前で組む範囲が広い。EChartsは高機能だがbundleが大きく、React接続とTailwindテーマの相性が弱い。TremorはReact 18固定で不採用。
- 手書きSVG継続は依存を増やさないが、チャート要件が増えた後はテストと実装が膨らむ。Recharts採用の方が全体差分は小さい。

## 影響

- Recharts導入時には `REQ-010 AC-010-1` の仕様変更issue（https://github.com/mryfmo/ai-ops-platform/issues/2）を参照し、依存追加PRで `package.json` とlockfileを更新する。
- チャートがclient componentになるため、初期表示とbundleへの影響をページ単位で確認する。
- 色覚多様性を前提に、RAGや警告色は冗長表現を必須とする。
- spec-change issue: https://github.com/mryfmo/ai-ops-platform/issues/2
