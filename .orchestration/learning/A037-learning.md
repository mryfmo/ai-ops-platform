# A037 learning triage

## Validated learning

Sandbox connection errors can masquerade as authentication failures. When plain `gh` reports `error connecting to api.github.com`, retry the same network operation with escalated execution before touching credentials. In this task, `gh api user` failed inside the sandbox but succeeded as the existing keyring identity `mryfmo` when escalated.

## Apply to

- Future GitHub diagnostics: distinguish network egress denial from keyring/token failure with an escalated retry.
- Security practice: do not mint, locate, or replace credentials until the same command has been tested outside the network-restricted sandbox.

## Decision

Promoted in this task artifact because the orchestrator explicitly requested it and the behavior was empirically validated. No project worklog learn file was created because it is outside A037's allowed file set.

## Revision learning

Validate calendar dates before selecting the maximum: lexicographic ordering and JavaScript date normalization can turn malformed values into false long coverage. Mixed invalid/valid data must also map to an alerting metric value; a startup warning boolean alone is insufficient.
