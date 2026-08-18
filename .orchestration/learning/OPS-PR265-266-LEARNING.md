# OPS-PR265-266 Learning Triage

- Reusable: yes.
- Candidate: match-head authorization must compare the complete 40-character OID; matching short prefixes do not override a full-OID mismatch.
- Candidate: a failed normal merge does not imply authority to use `--admin`; record partial side effects and request an explicit recovery ruling. If base update is authorized, bind approval and merge to the newly captured full head only after fresh CI passes.
- Promotion: not performed. The blocked report retains the `[memory:failure]` record for orchestrator review.
