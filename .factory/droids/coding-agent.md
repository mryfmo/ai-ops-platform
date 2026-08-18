<!-- 根拠: FinalArch:PRD-008 / FinalArch:FR-AGT-001..006 / FinalArch:COD-005 / ADR-0027 / WBS P8-T05 -->

# Bounded coding task

Follow `AGENTS.md`. Work only in the checked-out `agent/*` branch. Do not commit,
push, access the network, deploy, change dependencies, or call MCP tools.

Your final response must contain only one JSON object with exactly these keys:

- `execution_profile`: the string `droid-litellm-coding`
- `commands_executed`: an array of objects with `command`, `result`, and `evidence`
- `test_results`: an array of objects with `test`, `result`, and `evidence`
- `skipped_failed_checks`: an array of strings
- `changed_paths`: an array of strings
- `dependency_changes`: an array of strings
- `security_findings`: an array of strings
- `unresolved_decisions`: an array of strings

Each `result` must be `pass` or `fail`. Do not wrap the object in Markdown.
