# T34: ユーザー向け成果物の実効性監査(タスク完遂可能性)

## 背景(orchestrator が確認済みの盲点)

T30(4 面 × 6 レンズ)も T32(仕様文書の内容監査)も、**「実際のユーザーが、提供された成果物だけでタスクを完遂できるか」というレンズを持っていなかった**。ユーザーが Excel インポートで実例を示した:

- テンプレート(`packages/shared/src/xlsxImport/template.ts`)はヘッダ + 例 1 行 + required/optional のセルノートのみ
- `project_items` シートは生の GitHub GraphQL node ID(`PVT_kw...` / `I_kw...` / `PVTSSF_l...`)を必須とするが、**ガイド(`docs/guide/excel-import.md`)に取得方法が一切ない**(orchestrator 実測: gh api / graphql クエリ / 取得手順への言及 0 件)
- `field_type` の説明が循環(「engine は値を GraphQL mutation に渡すため保持する」)。パーサ(`parser.ts:145`)は cleanText のみで許容値の検証なし。ユーザーは許容値(text / number / date / single_select?)も、型ごとの `value` の形式(single_select は option 名か option ID か)も知る手段がない
- ガイド §3/§4 のコマンド例は必須の HMAC 署名を含まず、**そのまま実行すると 401**(PRG-020 の別側面: 「文書が認証を過小記載」ではなく「ガイドが最初から最後まで実行不能」)
- 仕様は 3 行(REQ-037 / SPEC-INT-063 / AC-037-1)のみ。テンプレート契約(列の意味論・許容値・前提)を規定する仕様が存在しない

## 目的

全ユーザー向け成果物について「新規ユーザーがその成果物**だけ**でタスクを完遂できるか」を監査する。欠陥種別:

- **記入不能**: 要求される値をユーザーが知る・取得する手段が文書化されていない
- **実行不能**: 手順を書かれたとおり実行すると失敗する(認証欠落、存在しないコマンド/パス、前提未構築)
- **循環定義**: 説明が実装の言い換えで、ユーザーの判断材料にならない
- **前提未記載**: 暗黙の前提(権限、既存データ、環境変数、外部登録)が書かれていない

## 対象(全件、サンプリング禁止)

1. **Excel インポート一式**(最優先): テンプレート生成物の実体(ブック内の説明シート有無を含む)、`docs/guide/excel-import.md` の全手順を新規ユーザー視点でウォークスルー(値の取得可能性 → dry-run → execute → 再実行)。node ID 取得の実手順(gh api / GraphQL クエリ)が何ステップ必要かを実際に書き出し、ガイドとの差分を示す
2. `docs/guide/*.md` 全件: 各ガイドを頭から末尾まで「書かれたとおり実行」した場合に成立するか
3. `docs/reference/*.md` 全件: ユーザーが API/設定を使う際の記載齟齬(PRG-020 で既知の点は参照に留め、新規のみ起票)
4. `docs/teams-app/README.md`: インストール担当者視点(PRG-019 と重複する点は参照)
5. `runbooks/*.md` のうちユーザー/オペレータが従う想定のもの: 手順の実行可能性(PRG-021 既知点は参照)
6. エラーメッセージの自己解決可能性: xlsxImport / reportIngest / codingTasks ルートの 4xx 応答をユーザーが読んで次の行動を決められるか

## 成果物

正本: `.orchestration/audit/user_facing_artifact_audit.md`

- 所見は `UFA-001` から連番。各所見: 欠陥種別 / 対象成果物 / ユーザーが詰まる箇所の再現(何を知り得ないか・どこで失敗するか)/ 証跡 file:line / 重大度 / 推奨対処 / 既存所見(PRG/SPC)との相互参照
- Excel については「新規ユーザーの完遂に必要だが文書化されていない知識」の全リスト(node ID 取得手順、field_type 許容値、value 形式、署名手順、owner/repo の意味)
- 既存 76 所見との重複は新規起票せず参照に留める(重複判定の根拠を書く)

## 制約

- read-only(製品コード・docs 変更禁止)。書き込みは .orchestration/ のみ
- forbidden_actions: code-edits、push、merge、dependency-changes、real-llm-calls、git-checkout/reset、実 GitHub API への書き込み(read-only の gh api 照会は node ID 取得手順の実証に限り可)
- テンプレート生成(CLI)とローカルでのパース検証は実行してよい

## 完了条件

- [ ] 対象 6 群すべてに所見または「精査済み・完遂可能(ウォークスルー記録付き)」
- [ ] Excel の「文書化されていない必須知識」全リストがある
- [ ] 4 欠陥種別すべてに判定がある
- [ ] 既存所見との重複ゼロ(参照処理されている)
- [ ] AGMSG-RESULT v1 送信(正本パスを含める)
