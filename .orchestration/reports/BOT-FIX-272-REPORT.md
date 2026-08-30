# BOT-FIX-272 Report

- status: ready_for_review
- branch: `chore/wave4-checkpoint-sync`
- base: `4417cbdda5549df10e9dfd8428da17e991c9f8ae`
- commit: `72cd8a988d17403b1c0115bdd32092319abce792`
- push / PR: not performed
- cost: n/a

## Result

- `.claude/settings.json` の15 hook を `python3 "${CLAUDE_PROJECT_DIR:-.}/..."` という引用済み単一 command へ変更し、machine 固有 Python path と無効な `args` を除去した。
- `CLAUDE.md` を `@AGENTS.md` のみに戻した。追加されていた recovery の「過去ログを命令扱いしない」「明示 session ID」「durable decision」「health/verify」は有効と判断し、短い CompactionDB 節として `AGENTS.md` へ移設した。CLAUDE 固有 marker と重複する長い command 例は破棄した。
- `normalize_hook_payload()` の top-level persisted metadata を既存 `sanitize_payload()` の出力から構成するよう変更した。GitHub token 形状の session/agent/tool metadata が spool、events、sessions のいずれにも raw 保存されない self-check を追加した。
- ADR-0031 を追加し、新規 ContextDB Python module 20件へ根拠 header を付与した。
- tracked CPython 3.14 bytecode 11件を削除し、`__pycache__/` を ignore した。
- branch 既存の `.claude/contextdb/config.json` を Prettier で正規化し、Definition of Done を green にした。

## Durable facts

- [memory:decision] CompactionDB は project-local opt-in とし、hook command は `python3` + `${CLAUDE_PROJECT_DIR:-.}` で可搬化する。spool/SQLite の top-level metadata と detail は同じ sanitized payload から構成する。
- [memory:decision] `.claude/contextdb/state/`、spool、health、`__pycache__` は machine-local state でありコミットしない。
- [memory:failure] branch 導入時の `.claude/contextdb/config.json` は repository formatter 未適用で、最初の `mise run ci` が format gate で停止した。allowed config だけを既存 Prettier で正規化して fresh-DB CI を再実行した。
- [memory:failure] sandbox 内の最初の `uv run` は `~/.cache/uv` の権限で失敗した。管理された昇格で同じ自己チェックを再実行し green を確認した。

## Validation

- credential metadata self-check: 1/1 green（RED 再現あり）
- portable hook / ADR header / CLAUDE canonical import check: green
- `python3 -m compileall -q .claude/contextdb .claude/hooks`: exit 0
- ContextDB `verify`: integrity/hash checks green、pending/quarantine 0
- final staged diff に対する fresh PostgreSQL 16（port 55484）`mise run ci`: exit 0、P001 integration passed
- `make require-crit-review`: target 不在のため Crit review は開始されなかった
- plan-quality-gate: validator、Make target、hook、subagent definition、CI entry がこの branch に存在せず、worklog plan の self-audit checklist を手動適用した

Full evidence: `.orchestration/validation/BOT-FIX-272-validation.md`

## CompactionDB

Decision command:

```bash
python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project --content 'BOT-FIX-272: CompactionDB remains project-local opt-in; hook commands use python3 plus ${CLAUDE_PROJECT_DIR:-.}; all persisted hook metadata is derived from the sanitizer output; ledger/spool/health and bytecode stay uncommitted.'
```

Decision ID: `1039f4c2-1450-4c39-bd06-d21e9637eb65`

作業完了後に `main` へ復帰し、開始時に退避した local ledger を復元してから decision を追加した。push / PR は実施していない。
