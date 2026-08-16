# P5-T06 Graph Interface Separation Report

## Outcome

Implemented the ADR-0024 type boundary between Microsoft Graph system integration and Work IQ delegated/OBO access. New Graph composition uses an opaque app-only token provider and a system-only capability surface; no delegated Graph interface was added.

## Contract

- `GraphAppOnlyToken` is the opaque token returned by the concrete shared `GraphTokenProvider`; no public string-to-brand constructor exists.
- The production MSAL provider attaches the private brand only after its client-credentials result passes nonblank, whitespace, expiry, and lifetime validation. A delegated bearer-shaped string provider cannot construct `GraphClient` at compile time.
- `GraphSystemClient` exposes the existing subscription, lifecycle, delta/read, and deterministic formal-write methods with `authenticationMode: "app-only"`.
- Existing `GraphClient` carries the same literal marker. Its constructor, token acquisition, HTTP requests, retries, validation, and results are unchanged.
- `WorkIqDelegatedToken`, its provider, and `WorkIqRestClient` remain unchanged and canonical for user-interactive delegated/OBO access.
- No calendar/meeting/SharePoint operation was invented where the runtime client does not already implement one.

[memory:decision] The concrete GraphClient token provider returns a branded app-only token from the validated MSAL client-credentials path, while GraphSystemClient exposes only system/background capabilities; Work IQ remains the sole delegated interface. Apply this boundary to future Graph composition and WIQ-003 tests.

## CompactionDB

The project instruction command was attempted but its repository CLI is absent:

`python3 .claude/hooks/contextdb_cli.py memory add --help`

Result: `[Errno 2] .claude/hooks/contextdb_cli.py: No such file or directory`. No project memory mutation was possible.

## Handoff

- Branch: `agent/P5-T06-graph-interface-separation`
- Orchestrator performs push and PR creation after `AGMSG-RESULT`.
