# A009 Learning

## Candidate Reusable Learning

Tests for a historical acceptance prefix must derive a bounded fixture by locating the named terminal task and slicing through it. A fixed numeric slice is brittle if earlier records change, while loading the full tracked manifest breaks as soon as later records are appended.

CLI coverage must consume the same bounded fixture as direct function coverage; pointing the CLI at the advancing tracked manifest silently reintroduces the coupling.

## Triage

- Reusable: yes, for future acceptance-manifest maintenance.
- Validated: yes, by the T10-triggered 9-test regression and the fixed 12/12 suite while T10 remains present.
- Promotion: not performed; A009 records the candidate only.
- Worklog learn update: not performed because the task forbids worklog edits.
