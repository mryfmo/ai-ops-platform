# BOT-FIX-289C Learning

- [memory:decision] dependency upgrade の lint を再現するときは、upgrade branch 自身の frozen lockfile を commit-free probe で install し、`pnpm -r --no-bail --if-present run lint` で全 workspace を一度に走査する。
- [memory:decision] implementation の終結証明は、実装 commit を probe へ `--no-commit` merge して全 lint を再実行し、merge abort・probe 削除・main frozen install の順で元へ戻す。
- [memory:decision] `try` と `catch` の全経路が唯一の read より前に変数へ代入する場合、`no-useless-assignment` は型付き宣言だけを残す1行差分で直せる。
- [memory:failure] lockfile の異なる branch へ切り替えた直後に package-level `pnpm run` を起動すると、pnpm が package `node_modules` を自動再構築することがある。branch switch ごとに root の frozen install を先に完了し、その後は direct binaries で focused verification する。
- [memory:failure] sandbox 内では `tsx` の IPC socket listen が EPERM になり、contracts test が実装と無関係に失敗し得る。同じ未使用 DB のまま sandbox 外で full command を再実行する。

CompactionDB decision: `63230c04-4b9d-419a-a94a-05863c577c55`

既存 command と native declaration だけで対応できたため、新しい共通 skill や dependency は追加しない。

cost: n/a
