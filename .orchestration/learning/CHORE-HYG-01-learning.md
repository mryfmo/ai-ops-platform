# CHORE-HYG-01 Learning

- [memory:decision] 追跡対象の生成物には壁時計や commit hash を埋め込まず、入力が同じなら同じ byte 列を返す。既存 task の末尾で generator 出力と index を `git diff --exit-code` すれば、追加依存なしで stale commit を止められる。
- [memory:decision] 鮮度 gate は、現在の統合 commit で CI が再実行されて初めて効く。base が動いた後は up-to-date branch の必須化か merge queue で再検証する。
- [memory:failure] 同じ shared worktree で複数の `vitest --coverage` を走らせると、各 process の cleanup が同じ package の `coverage/.tmp` を消し、無関係なテストが ENOENT で落ちる。並走を避け、競合後は fresh DB で全CIを最初からやり直す。
- [memory:decision] `aiops-pr-bot` の label 付与は pull_requests write で足りる。PR #291 の実測に基づき、Issues write は権限表から外す。

CompactionDB decision: `3cd8ca44-01af-4c63-8c06-ee635108b57a`

既存 generator、mise task、Git の差分判定だけで解けたため、新しい共通 skill や自動化は増やさない。
