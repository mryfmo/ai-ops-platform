# BOT-FIX-289B Report

`agent/BOT-FIX-289B` で、名前付き `catch` のエラーを別の組み込み Error に包み直す全5箇所へ、捕捉した値そのものを `ErrorOptions.cause` として追加した。コンストラクタ、メッセージ、分岐は変更していない。

## 修正箇所

- `packages/composition/src/runtime.ts:40`
- `packages/devops/src/agents/AGT_RPT.ts:140`
- `packages/server/src/config.ts:591`
- `packages/server/src/index.ts:269`
- `packages/web/src/server/config.ts:178`

実装 commit: `54f4e6555d6fc494a79bcff9f2ed71e4666a4069`

## 掃引と境界確認

- TypeScript AST で `packages/*/src` の catch 内にある組み込み Error の再 throw を列挙し、ESLint 10.9.1 の `preserve-caught-error` を明示指定して同じ5件を確認した。
- 引数なし catch は、recommended の既定値 `requireCatchParameter=false` の対象外なので変更していない。
- composition/server の起動ログは wrapper の `message` のみを出す。server/web の設定エラーは既存メッセージに同じ情報が含まれる。Jira mapping は既存と同じ path/message を保持する。
- AGT_RPT は分類済み監査値だけを出力し、既存 JSON-spread 検証で native Error の非列挙 `cause` が本文やメールへ流出しないことを確認した。見送り箇所はない。

## 検証

- 変更前に forced rule が5件を検出し、AGT_RPT の cause 同一性テストが expected RED になった。
- 変更後の focused tests は composition 16、devops 13、server 78、web 12 tests が成功した。
- forced `preserve-caught-error` sweep は exit 0。
- fresh PostgreSQL 16 cluster で `mise run ci` が P001 integration まで exit 0。
- ローカル Crit data の review-scope record `r_775f88` は解決済みで、指摘なし。

`@eslint/js` は現状 9.39.5 のため v10 recommended 設定全体は変更していない。ローカルの ESLint core 10.9.1 による対象ルールの直接検証は済んでおり、PR #289 CI が最終確認先となる。

CompactionDB decision: `c0ec5cbd-23d7-430f-ad4c-8354c165da5c`

cost: n/a
