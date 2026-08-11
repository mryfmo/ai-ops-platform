# A008 Learning

## Candidate Reusable Learning

Acceptance tests for a fixed historical prefix must construct an explicit prefix fixture. Loading an advancing tracked manifest makes those tests fail as soon as the next independently accepted record is appended.

Generated reports with a timestamp should be compared after removing only the timestamp line; equal normalized hashes distinguish a harmless regeneration from a semantic regression.

## Triage

- Reusable: yes, for future acceptance-manifest maintenance and generated-output acceptance.
- Validated: yes, by the T10-record regression, the passing production through-T10 validator, and identical normalized matrix hashes.
- Promotion: not performed; A008 records candidates only.
- Worklog learn update: not performed because the task forbids worklog edits.
