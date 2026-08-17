# P7-T09 Learning

## Reusable Findings

1. A deep link can preserve operational context without exposing stable identity: sign the context and bind the subject through a domain-separated HMAC digest.
2. Single-use security needs an injected atomic consume authority. A process-local set is not a safe production fallback; missing durable composition must fail closed.
3. Token possession and authorization are distinct. Consume the token once, then re-resolve the current session and resource grant on every request.
4. Uniform denial must cover authentication, token parsing, replay, upstream authorization, and nested workflow membership so no branch becomes an existence oracle.
5. A render boundary should accept a branded, origin-validated URL rather than a raw string, even when the upstream mint function already signs the token.
6. Content-minimizing link schemas are stronger than sanitizing content after inclusion: message text and attachments should not be accepted by the mint contract at all.

## Apply To

- Future Teams/Workbench composition, persistent replay-ledger implementation, notification deep links, and any UI surface that renders signed operational URLs.

No new skill or rule was promoted by this worker.
