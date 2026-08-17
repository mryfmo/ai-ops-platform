# P8-T04 Claude Execution Profile Report

## Outcome

Hardened the Claude Code composite action as a fixed, auditable execution profile. The
action now verifies the exact Linux x64 Claude Code 2.1.222 artifact before installation,
requires an `agent/*` branch, constrains tools and invocation budgets, and emits strict
profile-bound callback evidence.

## Security Boundaries

- The native artifact is downloaded from its exact npm registry URL and checked against
  SHA-256 `6680125b6f3baab47c84797cbeb3196e343c61bb4679cae15d138041a325c1ff`
  before extraction or installation.
- Only the scoped LiteLLM virtual key reaches the execution step. The installer receives
  no model credential, and the action exposes no provider/master-key input.
- `dontAsk`, safe mode, an empty strict MCP configuration, a minimal built-in tool list,
  and explicit network/deploy/git-mutation denies fail closed without interactive grants.
- Caller-provided limits may be reduced but cannot exceed 1,800 seconds, 25 USD, 200,000
  task tokens, or 500 agentic turns.
- Structured output rejects extra fields and binds evidence to
  `claude-code-fable5-xhigh`, which remains an audit label rather than a model capability
  assertion.

## Scope Decision

The orchestrator approved option A: this task changes only the composite action and its
static contract. Task-manifest path/budget dispatch, P8-T02 guard wiring, raw parallel
tool-call counting, and evidence persistence remain P8-T08/P8-T09 work. No staging E2E or
OS-level egress isolation is claimed.

## Delivery

- Branch: `agent/P8-T04-claude-exec-profile`
- Base: main `6f3a2acbb420928baf08565e235f55f74a6689a4`
- Dependencies added: none
- Production configuration changed: none
- Cost: n/a
