# BOT-FIX-272 Acceptance

- task_id: BOT-FIX-272
- status: accepted
- date: 2026-08-30
- reviewer: claude-deep-dot (orchestrator)
- commit: 72cd8a988d17403b1c0115bdd32092319abce792 (branch chore/wave4-checkpoint-sync, parent 4417cbd)
- cost: n/a (worker-reported)

## Adversarial review performed

- スコープ: allowed_files 内のみ（settings.json / CLAUDE.md / AGENTS.md 最小節 / contextdb・hooks py / .gitignore / ADR-0031 / self_check.py）。packages/**・依存・ledger 実データ不変更
- Fix1（3800867000）: 15 hook を `python3 "${CLAUDE_PROJECT_DIR:-.}/..."` 単一 command へ。`/Users/` と `args` の残存 0 を独立 grep で確認
- Fix2（3800867007）: CLAUDE.md は `@AGENTS.md` のみへ回帰。有効な recovery 指針は AGENTS.md「CompactionDB」節へ簡潔に移設、重複 command 例は破棄
- Fix3（3800867014）: persisted metadata を `sanitize_payload()` 出力由来へ変更。credential 形状 metadata の非 raw 保存 self-check を orchestrator 自身の実行で再現（1/1 pass、RED 再現は validation に記録）
- Fix4（3800867017）: ADR-0031（CompactionDB opt-in）を新設し、新規 Python 20 module へ `根拠: ADR-0031` ヘッダ。AGENTS.md の ADR 列挙にも 0031 追記
- 混入物: tracked .pyc 11件を削除、`__pycache__/` を ignore
- 独立検証: `python3 -m compileall` exit 0、self_check 1/1 pass（orchestrator 実行）。validation の失敗マーカー3件は開示済み初回 format 失敗のみで、最終 fresh PostgreSQL `mise run ci` exit 0
- CompactionDB decision 1039f4c2-1450-4c39-bd06-d21e9637eb65 を DB 直接確認

## Integration

origin/main（#279/#280/#281/#271/#273/#277/#282 反映後）を branch へ merge、BOT-FIX-272 証跡を同 branch へ commit、push→bot 4コメント返信→CI green→スレッド解決→マージ。

cost: n/a
