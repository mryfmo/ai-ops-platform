# T26 Learning

## What We Learned

- Official Anthropic docs for `claude-opus-4-8` state that non-default `temperature`, `top_p`, and `top_k` return 400. Escalation requests must omit these sampling parameters.
- Anthropic extended thinking is incompatible with modified `temperature` and `top_k`. Page-agent calls using Anthropic thinking must not set `temperature`.
- `claude-sonnet-4-6` remains usable for this codebase but is behind newer model IDs; migration should be a separate compatibility task because thinking and sampling behavior changes.
- AI SDK v5 UI streams can emit an error event and still resolve `Response.text()`; stream error tests should assert the error event and finish reason rather than expecting the response read to reject.
- PostgreSQL advisory locks used inside the same statement as the guarded SUM do not refresh the statement snapshot; use `BEGIN` then lock in a separate statement before reading the budget.
- Numeric grounding without an LLM judge is lexical only: grouped numerals and period labels can be normalized, but spelled-out numbers and semantic misuse of an allowed number remain out of scope.
- Period labels must be stripped as exact literals before numeric extraction; adding their digit fragments to the allowed metrics set lets labels like `2026-Q3` justify unrelated `3` values.
- AI SDK Anthropic refusal for chat streams is represented by `finishReason: "content-filter"` in this dependency set; tests should not invent provider metadata shapes that the SDK does not emit.

## Where Applied

- ADR-0002 documents the intentional `claude-sonnet-4-6` pin and Opus 4.8 sampling constraint.
- ADR-0013 documents the thinking + temperature constraint.
- Chat route tests assert omitted `temperature` and stream error reservation behavior.
- Anthropic client tests assert escalation request parameters and refusal handling.
- PgCostGuard reserve tests assert statement order, not a fake concurrent database behavior.
- Report validation tests now reject standalone digits that merely match period label fragments.
