<!-- 根拠: ADR-0006 -->

# 07 ローカルブランチ差分評価（ADV-DLT）

対象: ローカル `agent/T-P0-04`（HEAD = `3d29e5c`）と作業ツリーの未コミット変更・untracked 群。基準: `origin/main` = `631fcef`。

**判定: このブランチに取り込むべき差分は存在しない。** ブランチ固有コミットはゼロ（完全マージ済み）で、唯一 main と方向が異なるのは非正本 pptx による正本の上書きであり、これは取り込むべきでない差分である。

## ADV-DLT-001 [Low] ブランチ本体は完全マージ済み — 廃棄可能

- 実証: `git merge-base origin/main agent/T-P0-04` = **`3d29e5c` = ブランチ HEAD そのもの**。`git merge-base --is-ancestor agent/T-P0-04 origin/main` が成立。ブランチ固有コミットは **0 件**、behind 190 / ahead 0。
- リモート `origin/agent/T-P0-04` = `4dbc507`（ローカルより 1 コミット先: `test(auth): verify token acquisition single flight`）も **origin/main の祖先**であることを確認済み。
- 処遇: ローカル・リモートともブランチ廃棄可。「(ii) ブランチにのみ価値ある差分」「(iii) 衝突・矛盾コミット」はいずれも存在しない。

## ADV-DLT-002 [Medium] 未コミットの pptx 変更が正本を非正本で上書きしている

- 実証: ブランチ HEAD および origin/main の `docs/AI_Ops_Platform_Summary.pptx` は 515,967 bytes（12 枚正本）で一致。ローカル作業ツリーの同ファイルは 656,723 bytes で、**origin/main の `references/AI_Ops_Platform_Summary.pptx`（添付 14 枚版）とバイト一致**。
- main 側は `plans/013` PA-09 で「添付 14 枚版はリポジトリ正本と不一致、P010-F00-T03 が不採用とした現在形主張を含む」と明記し、意図的に docs = 12 枚正本 / references = 14 枚参考 を分離している。この作業ツリー変更をコミットすると main の決定と真っ向から矛盾する。
- 処遇: **廃棄推奨**（14 枚版は main の references/ に既に保存済みで失われるものはない）。

## ADV-DLT-003 [Low] traceability_matrix.md の未コミット変更はタイムスタンプのみ、かつ main より古い

- 実証: 差分は生成日時 1 行のみ（2026-07-11T05:35 → 07-11T23:41）。origin/main の同ファイルは 2026-07-18T00:42 生成でさらに新しい。処遇: 廃棄可能。

## ADV-DLT-004 [Medium] untracked の docs/audit/ が main の「古い版」で、指示内容が矛盾する

- 実証: 10 ファイル中 8 ファイルは origin/main とバイト一致。差分のある 2 ファイルはローカルが古い版:
  - main の `09-remediation-plan.md` は冒頭に「**履歴資料 — 現行の実行正本ではありません**」ヘッダを持ち、正本を `docs/spec/productization-decisions.md` と Plan 010 に移譲。ローカル版は「これが作業の正本である」と主張する監査時点スナップショット。
  - main の `05-traceability.md` は AUD-TRC-001 を「原本配置は解消済み（2026-07-14 に docs/spec/ へ配置）」へ更新済み。ローカル版は未解消時の記述。
- リスク: ローカル版を開いて作業すると、既に上書きされた指示に従ってしまう。**これがまさに監査文書の二重管理**。処遇: 全 10 ファイル廃棄可能（取り込み価値のあるローカル固有内容なし）。
- 注記: 本レビューの成果物 `docs/audit/2026-08-05-adversarial-review/` は新規サブディレクトリであり、この重複問題とは独立している。ただし main へ取り込む際は、上記 10 ファイルを廃棄してから追加するのが安全。

## ADV-DLT-005 [Low] untracked の plans/0018 / plans/013 は main に上位互換で吸収済み

- 実証: `plans/0018-page-agent-architecture.md`（ローカル、ステータス「提案」）は main では **`docs/adr/0018-page-agent-architecture.md`**（「採用 — 2026-07-18」、コミット `b51ab1f`）として正規パスで採用済み。冒頭 30 行は同一内容。`plans/013-page-agent-pptx-parity.md` のローカル版は "Planned at" がプレースホルダのままの草稿で、main 版（`358337e`）は記入済み。処遇: 両方廃棄可能。

## ADV-DLT-006 [Low] untracked の references/ は main 追跡ファイルの重複コピー

- 実証: `references/ai-ops-platform-wireframe_4.html` は origin/main の追跡ファイルとバイト一致。`references/AI_Ops_Platform_Summary (1).pptx`（Finder 由来の "(1)" 名）は main の `references/AI_Ops_Platform_Summary.pptx` とバイト一致。処遇: 廃棄可能（"(1)" は main 移行後も stray untracked として残るため明示削除推奨）。

## ADV-DLT-007 [Medium] untracked 群が main への checkout をブロックしている

- 実証: `docs/audit/*.md`・`plans/013-page-agent-pptx-parity.md`・`references/ai-ops-platform-wireframe_4.html` はローカルで untracked だが origin/main では追跡対象。git は内容一致でも「untracked working tree files would be overwritten by checkout」で **`git switch main` / merge を拒否する**。
- 影響: この作業ツリーは現状 main へ移行できず、放置すると古いブランチ上での作業継続を構造的に誘発する。処遇: untracked 群を退避または削除してから main へ切替。

## ADV-DLT-008 [Medium] 放置時のツールチェーン逆行リスク

- 実証: ブランチの `.mise.toml` は node 20 / pnpm 9.15.4、devDeps は vitest ^2.1.4 / @types/node ^20。origin/main は **node 22 / pnpm 11.13.0 / vitest 4.1.10 / vite 8.1.4** に加え actionlint タスク、拡張された `governance:check`（canonical-spec-mirrors 検証・plane-mapping 検証）、`acceptance:validate`、負荷検証タスクを持つ。
- 影響: このブランチ上で `mise run ci` を回しても main の Definition of Done とは別物の検証しか通らず、lockfile も pnpm 9 形式で汚染される。**本レビューの動的検証を scratchpad worktree（main）で行ったのはこの理由による**。処遇: このブランチでの新規作業を停止し速やかに廃棄。

## ADV-DLT-009 [Low] untracked の .agents/ / .codex/ はローカル成果物

- 実証: `.agents/worklog/`（worklog・learn・plan 記録）と `.codex/hooks.json`（agmsg の Stop フック、絶対パス入り）。origin/main の `.gitignore` は `.orchestration/` と `.DS_Store` を無視するが `.agents/` `.codex/` は無視しないため、untracked ノイズとして誤コミットの余地がある（秘密情報は含まれていない）。処遇: main へは持ち込まない。ノイズが問題なら `.gitignore` 追加を main 側で別途検討。

## 推奨最終処遇

未コミット変更（pptx・matrix）と untracked 重複群（docs/audit の旧 10 ファイル、plans/0018、plans/013、references）を破棄し、`.agents/` `.codex/` と本レビュー成果物のみを残した上で、ローカル・リモートの `agent/T-P0-04` を削除して main へ移行する。
