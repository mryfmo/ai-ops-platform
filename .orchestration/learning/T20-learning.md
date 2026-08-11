# T20 Learning

- HMAC-protected binary upload routes should verify the raw `Buffer`, not parsed form/body data.
- For side-effecting imports, the ledger must reserve the source key before the external write. A post-write insert is not idempotency.
- For outbound email delivery, a `pending` delivery log before `sendMail` is the minimal recoverable state. Replays from pending must be visible to recipients via `(再送)` rather than silently sending an indistinguishable duplicate.
- Report IDs must be based on content identity. Generation timestamps belong in metadata/storage, not the idempotency key.
- Traceability corpus must include server code when server-owned scheduler/routes implement PrjOps or DevOps requirements.

