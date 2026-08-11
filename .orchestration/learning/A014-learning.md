# A014 Learning

## Validated Learnings

- A stable-subject migration must not invent UUIDs for legacy email-only rows;
  inactive/pending quarantine makes the unresolved state explicit for the
  signed mapping task.
- A trusted tenant value belongs in repository construction, not a per-call
  argument that a caller could accidentally populate from the same untrusted
  claim being checked.
- Profile capability alone is insufficient for scope backfill. A PRF-04 row
  with a project allowlist must remain project-scoped; global is safe only for a
  global-capable profile with no project allowlist.
- Catalog assertions and rollback rehearsal catch constraints/index/privilege
  drift that source-string tests cannot prove.

## Application

- Applied to the recipients fresh schema, upgrade migration, trusted-tenant
  repository lookup, and PostgreSQL integration fixtures in this task.
- Worklog learn update was not performed because A014 forbids worklog edits.
