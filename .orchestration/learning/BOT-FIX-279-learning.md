# BOT-FIX-279 Learning

## Reusable lessons

- Generic schema validation is not authority binding. Before credential issuance, compare the decoded manifest to independently supplied task, branch, and writer identity inputs.
- Wiring tests can avoid duplicating an issuer's mapping by executing the production issuer read-only and passing its exact output through the workflow's actual embedded validator program.
- A failure object should have its own strict contract when it cannot truthfully satisfy the success artifact's required fields. Validate it before writing or uploading it.

## Residual risk: attestation

This task binds identity fields but does not add trusted server-signed manifest attestation. Manual dispatch still supplies both manifest bytes and digest, so a caller can construct a matching pair with the correct task/agent/branch and different schema-valid path or budget authority. Closing that gap requires issuer-authenticated digest retrieval or signature verification before credential issuance; it was explicitly outside BOT-FIX-279 scope.

## Promotion

No new Codex learn file was promoted. The attestation boundary is recorded in the task report, this learning artifact, and CompactionDB decision `5a0b442f-9ce3-420b-b0fa-819bbc9dc253`.
