# BOT-FIX-272 Learning

## Reusable lessons

- [memory:decision] Claude Code command hook は実行可能な command 文字列を正本とし、script path と引数をその文字列へ含める。repository hook は `${CLAUDE_PROJECT_DIR:-.}` を使い、user/mise version 固有 path を固定しない。
- [memory:decision] payload sanitizer がある場合、detail だけでなく top-level correlation metadata も同じ sanitized copy から永続化する。raw payload を後から参照すると spool/DB 境界を迂回する。
- [memory:failure] opt-in asset を導入した branch でも formatter を通していない config が全 CI を止める。導入直後に repository formatter を対象 asset 全体へ実行する。
- [memory:failure] `compileall` は source tree に `__pycache__` を生成するため、bytecode ignore と tracked-bytecode inventory をセットで確認する。

## Promotion

新規 Codex learn は作らない。task 固有の CompactionDB 可搬化規則は ADR-0031、AGENTS.md、project CompactionDB decision に集約した。

CompactionDB decision command:

```bash
python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project --content 'BOT-FIX-272: CompactionDB remains project-local opt-in; hook commands use python3 plus ${CLAUDE_PROJECT_DIR:-.}; all persisted hook metadata is derived from the sanitizer output; ledger/spool/health and bytecode stay uncommitted.'
```

cost: n/a
