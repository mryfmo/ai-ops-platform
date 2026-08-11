# P005-T09 Acceptance

Status: accepted

- Replaced the direct client-credential OAuth POST and custom TTL cache with `@azure/msal-node` 5.4.0, whose installed package requires Node >=20 and matches the repository Node 20 baseline.
- Production server and subscription CLI use the MSAL provider with fixed Microsoft authority host and `https://graph.microsoft.com/.default`; sequential cache/refresh remains MSAL-owned and only concurrent acquisition is single-flight.
- The initial result was independently rejected for whitespace-surrounded token acceptance and inaccurate dependency-audit claims. A high-reasoning revision added red-first fail-closed coverage and corrected all five artifacts.
- Independent final re-review `/root/p005_t09_review` accepted the revision and confirmed neither prior root cause nor the earlier nested-path mistake recurs.
- Final focused validation passed 44/44 tests; final post-revision `mise run ci` passed 955 tests.
- `pnpm audit --prod --json` still reports 1 low and 3 moderate advisories on existing non-MSAL paths; these are not waived and remain security-hardening work.
