# BOT-FIX-279 Report

- status: ready_for_review
- branch: `agent/ADV-FIX-04`
- commit: `18584a4d70b6653f0afba14d94e41e566611d3ee`
- cost: n/a
- push/PR: not performed
- reviewed PR: https://github.com/mryfmo/ai-ops-platform/pull/279

## Result

Resolved both adjudicated PR #279 bot findings within the seven-file task allowlist.

The coding workflow now validates the decoded manifest against the dispatch `task_id`, exact `agent/<task_id>` delivery branch, and server-issued writer identity before any credential is issued. The wiring test executes the workflow's actual heredoc validator against manifests produced by the unchanged server issuer, then proves branch, task, and agent substitution fail closed.

Digest failures now use the standalone `failure-1.0` review artifact contract. The new schema and validator reject success-schema confusion, missing evidence, malformed source data, empty findings, and unknown fields; the collector validates the artifact before exclusive creation.

No `packages/**`, dependency, lockfile, mise, existing schema, or schema-loosening change was made.

## Durable facts

- [memory:decision] Coding workflow credential issuance is preceded by exact dispatch binding for manifest task ID, delivery branch, and server-issued writer identity.
- [memory:decision] Review digest failures use a distinct strict `failure-1.0` artifact contract rather than an invalid partial success artifact.
- [memory:failure] Binding does not cryptographically attest caller-supplied manifest bytes or digest. A caller can still self-author a schema-valid manifest with the bound identity fields but altered paths or limits until trusted server-signed digest attestation is added.

## Validation

- Task focused suite: 31/31 green.
- Manifest wiring suite: 3/3 green.
- `mise run ci`: green, including governance, contracts, actionlint, format, build, typecheck, coverage, and fresh-PostgreSQL verification.
- `make require-crit-review`: unavailable (`No rule to make target`). `crit status --json` reported no review file/session, so no browser review was opened.

Full verbatim output is in `.orchestration/validation/BOT-FIX-279-validation.md`.

## CompactionDB

Project-local CLI recovery command:

```text
compactiondb-install . --skip-instructions
```

Decision command:

```text
python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project --content "BOT-FIX-279 binds workflow_dispatch manifests to exact task_id, agent/<task_id> branch, and the server-issued writer agent_id before credential issuance; digest failures now emit the separate strict failure-1.0 review artifact contract. Server-signed manifest attestation remains out of scope, so caller-supplied manifest bytes and digest retain that documented residual risk."
```

Result: `5a0b442f-9ce3-420b-b0fa-819bbc9dc253`.

Installer-created `.gitignore`, hook, and settings changes were restored/removed after the decision write; the pre-existing project context database was retained.
