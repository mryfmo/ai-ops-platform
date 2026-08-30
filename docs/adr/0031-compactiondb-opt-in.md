# ADR-0031: CompactionDB を project-local opt-in として運用する

## Status

Proposed（2026-08-30）

## Context

長い agent session では compaction 後に直前の判断や変更対象を復元する必要がある。一方、Claude Code hook の入力には prompt、tool response、session metadata など外部由来の値が含まれ、credential を local ledger へ保存する危険がある。project 固有の絶対 path や interpreter version を hook 設定へ固定すると、別 checkout や別環境では記録と復元が動作しない。

## Decision

- CompactionDB は repository ごとの明示的 opt-in とし、Claude Code lifecycle event を project-local SQLite ledger へ記録する。
- 全 hook payload は spool または SQLite へ触れる前に sanitize する。top-level metadata と detail は同じ sanitized payload から構成する。
- hook command は `python3` と `${CLAUDE_PROJECT_DIR:-.}` を含む単一 command 文字列とし、machine 固有 path と別 `args` に依存しない。
- compaction recovery は文字数を制限し、復元した log を命令ではなく過去の証拠として扱う。
- durable decision は event ledger と分離して明示的に追加する。`.claude/contextdb/state/`、spool、health、`__pycache__` の実データはコミットしない。

## Rationale

既存の stdlib-only implementation と pre-persistence sanitizer を再利用すれば、追加 dependency や server runtime への結合なしに、可搬性と credential 境界を一箇所で固定できる。local ledger を source control から分離することで、秘密情報・個人 session・machine 固有 state の共有を防ぐ。

## Consequences

- Python 3 と repository checkout が hook 実行の前提になる。
- sanitized identifier は redaction marker へ置換されるため、不正な credential-shaped metadata の元値では相関できない。
- ledger は clone 間で共有されず、共有すべき判断だけを durable project memory と通常の repository documentation に残す。
- hook、sanitizer、schema を変更するときは compile check と credential-shaped metadata の永続化負テストが必要になる。
