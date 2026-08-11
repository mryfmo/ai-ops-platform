# A012 Learning

## Validated Learnings

- A contract validator must preserve the normative schema exactly; adding a
  plausible `uniqueItems` rule is still a contract break. The Crit regression
  case caught this for Seven Keys assessments.
- Failure-table ordering is easiest to preserve by separating byte
  canonicalization, strict document parsing, identity/uniqueness/reference
  checks, partial checks, and checksum comparison in that order.
- Ownership bounds need a dedicated semantic pass when the contract requires
  `E-SNAPSHOT-OWNERSHIP`; embedding the bounds in the generic schema pass would
  incorrectly return the higher-priority generic schema code.

## Application

- Applied to the pure snapshot validator and its contract-boundary tests in this
  task.
- Worklog learn update was not performed because A012 forbids worklog edits.
