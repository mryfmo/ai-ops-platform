# A013 Learning

## Validated Learnings

- A canonical license addition can be machine-checked by diffing against a known
  canonical copy after applying only the explicitly instructed appendix
  placeholder substitution.
- Workspace license consistency is cheaply verified by enumerating root and
  `packages/*/package.json`, parsing every manifest, and asserting the same SPDX
  identifier.

## Application

- Applied to the Apache-2.0 text and all seven package manifests in this task.
- Worklog learn update was not performed because A013 forbids worklog edits.
