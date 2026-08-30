# AGMSG-TASK BOT-FIX-272: PR #272 bot指摘の是正（CompactionDB opt-in の可搬化・境界強化）

- task_id: BOT-FIX-272
- repo: /Users/mryfmo/Workspace/ai-ops-platform
- 依頼者: claude-deep-dot（orchestrator）
- max_turns: 40

## Objective

PR #272（branch `chore/wave4-checkpoint-sync`）の Codex bot P1 指摘4件+コミット混入物を是正し、`mise run ci` green でコミットする。

## Branch

`git fetch origin chore/wave4-checkpoint-sync && git switch chore/wave4-checkpoint-sync`（origin追従）。直接コミット、push禁止。作業完了後は `git switch main` に戻すこと。

## Fixes

1. **（comment 3800867000）.claude/settings.json hooks の可搬化**: Claude Code の command hook は `command` 文字列のみ実行し `args` 配列は付与されない。かつ `/Users/mryfmo/...` 絶対パスは他環境で存在しない。各 hook を「インタープリタ + 引用済みスクリプトパス + 必要引数」を1つの `command` 文字列に collapse し、パスは `"$CLAUDE_PROJECT_DIR"` 変数参照（fallback 込みなら `"${CLAUDE_PROJECT_DIR:-.}"`）で可搬化する。`args` キーは削除。
2. **（comment 3800867007）CLAUDE.md の正本回帰**: CLAUDE.md は `@AGENTS.md` インポートのみへ戻す。branch 側で CLAUDE.md に追加された運用指示は、内容が有効なら AGENTS.md の適切な節へ移設し、AGENTS.md 既存内容と重複するものは破棄（REPORT に判断を記載）。
3. **（comment 3800867014）normalize.py の sanitize 境界**: hook/ingest payload の `session_id` 等 metadata が raw のまま spool/SQLite へ書かれる経路を閉じる。persisted metadata は sanitized_payload 由来にするか、識別子形状（例: UUID/hex/長さ上限の allowlist パターン）を strict 検証して credential 形状の値を通さない。負テスト（credential 形状の session_id が保存されない/quarantine される）を contextdb の既存自己チェック方式に合わせて追加。
4. **（comment 3800867017）新規 Python モジュールの根拠IDヘッダ**: `.claude/contextdb/contextdb/*.py` と `.claude/hooks/*.py` 全新規ファイル先頭に根拠IDコメントを追加。適切な spec ID が存在しないため、**`docs/adr/0031-compactiondb-opt-in.md` を新規作成**（既存 ADR 書式: ステータス/コンテキスト/決定/根拠/影響。CompactionDB opt-in の目的・ledger 非コミット原則・hook 構成を記録）し、ヘッダは `ADR-0031` を引用する。docs/README.md の ADR 一覧更新は不要（adr/ ディレクトリリンクのみのため）。AGENTS.md の ADR 列挙行に 0031 を追記。
5. **コミット混入物の除去**: branch がコミットしている `.claude/contextdb/contextdb/__pycache__/*.pyc` を `git rm` し、`.gitignore` に `__pycache__/` を追加（branch 側 .gitignore 変更と整合させる）。

## Validation（verbatim）

- `python3 -m compileall -q .claude/contextdb .claude/hooks`（構文健全性）
- Fix 3 の負テスト実行結果
- `mise run ci`
- `git log -1 --format='%H %s'` / `git status --porcelain`

## allowed_files

- .claude/settings.json / CLAUDE.md / AGENTS.md（Fix 2 の移設と ADR 列挙行のみ）
- .claude/contextdb/**（.py, config.json, .gitkeep 類）/ .claude/hooks/*.py
- .gitignore
- docs/adr/0031-compactiondb-opt-in.md（新規）
- .orchestration/{reports,validation,sandboxes,learning,autoskill/runs}/BOT-FIX-272*
- .agents/worklog/codex/**

## forbidden_actions

- git push / PR 操作 / 他ブランチ変更（作業後 main へ戻る以外の checkout 継続禁止）
- packages/** の変更、依存追加、lock/mise 変更
- `.claude/contextdb/state/`・ledger 実データのコミット
- LLM API 呼び出し

## Expected artifacts

- report / validation / sandbox / learning / autoskill: .orchestration 配下 BOT-FIX-272*（cost: 行、[memory:decision]/[memory:failure]、CompactionDB decision コマンド全文）
- done_signal: AGMSG-RESULT v1

## 注意

- .orchestration の BOT-FIX-272 証跡ファイルは main 側で sync するため、この branch へはコミットしない（untracked のまま残す）。
