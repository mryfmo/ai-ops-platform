<!-- 根拠: P010-F02-T01 / DEC-SPEC-003 -->

# Persona and scope matrix

Authorization is the intersection of a validated stable subject, an active
assignment, its domain, and its scope. `NULL`, empty, unknown, or malformed
profile/scope values grant no access.

## Assignment contract

| Domain   | Profile    | Allowed `scope_mode` | Effective project set                                                       |
| -------- | ---------- | -------------------- | --------------------------------------------------------------------------- |
| `prjops` | `PRF-01`   | `project`            | assigned project only                                                       |
| `prjops` | `PRF-02`   | `project`            | assigned project only                                                       |
| `prjops` | `PRF-03`   | `project`            | managed project only                                                        |
| `prjops` | `PRF-04`   | `project`, `global`  | assigned project, or all active PrjOps projects only when explicitly global |
| `prjops` | `PRF-05`   | `project`            | `invested_project_ids` only                                                 |
| `prjops` | `investor` | `project`            | same authorization audience as `PRF-05`; `invested_project_ids` only        |
| `devops` | `PRF-M`    | `project`            | assigned project only                                                       |
| `devops` | `PRF-L`    | `project`            | led project only                                                            |
| `devops` | `PRF-G`    | `project`, `global`  | managed project, or all active DevOps projects only when explicitly global  |

`PRF-05` and `investor` are aliases for one audience, not simultaneous personas.
They receive only code-calculated aggregates and the existing investor masking
rules. No other profile may have global scope. A project-scoped assignment
requires one canonical `PJ-*` project ID. A global assignment has no project ID.

The authoritative assignment fields and strict types are defined by
`schema/prjops-data.schema.json#/$defs/assignment`.

## Persona selection

Active personas are reread for every request and sorted for display by:

1. profile order `PRF-01`, `PRF-M`, `PRF-02`, `PRF-L`, `PRF-03`, `PRF-G`,
   `PRF-04`, `PRF-05/investor`;
2. domain ASCII order;
3. project ID ASCII order, with global after project-scoped entries.

This order is display-only and never an authorization priority.

- Exactly one active persona: select it automatically.
- More than one and no valid signed selection cookie: show only the selector;
  authenticated APIs return `409 E-AUTH03`.
- A signed selection must exactly match a currently active assignment. An
  unknown, stale, inactive, expired, or scope-mismatched selection returns
  `403 E-AUTH02`.

## Request-time scope predicates

| Operation           | Required predicate                                                          |
| ------------------- | --------------------------------------------------------------------------- |
| project list/picker | stable subject AND active assignment; return only effective project set     |
| one-project read    | requested project is in effective project set                               |
| portfolio read      | active explicit global `PRF-04`/`PRF-G` only                                |
| investor read       | active `PRF-05/investor` and requested project is in `invested_project_ids` |
| report delivery     | recipient and selected audience remain active at delivery time              |

Authorization filtering occurs in the data query. UI masking and post-fetch
filtering are not authorization controls. Identity fixtures and expected
decisions are in
[`fixtures/identity-contract-cases.json`](fixtures/identity-contract-cases.json).
