# BOT-FIX-289B Learning

- [memory:decision] 名前付き catch の値を新しい組み込み Error に置き換える場合は、constructor と message を保ったまま、捕捉した値そのものを native `ErrorOptions.cause` に渡す。
- [memory:decision] cause 追加前に外部境界を追い、wrapper message だけを描画するか、分類・sanitization 後の値だけを送出し、raw cause を serialize しないことを確認する。
- [memory:decision] ESLint 10 `preserve-caught-error` の既定 `requireCatchParameter=false` では、引数なし catch は recommended 違反に数えない。
- [memory:failure] 診断に `pnpm exec` を使うと、壊れた `node_modules` の暗黙復元を始めることがある。依存変更禁止の検証では、既に install 済みの `./node_modules/.bin/*` を直接実行する。
- [memory:failure] macOS sandbox 内の PostgreSQL `initdb` は SysV shared memory で失敗し得る。fresh DB 検証は限定した一時ディレクトリを承認済みの外部環境で初期化する。

CompactionDB decision: `c0ec5cbd-23d7-430f-ad4c-8354c165da5c`

既存の native API と lint rule だけで再現・修正できたため、新しい共通 skill や依存は追加しない。

cost: n/a
