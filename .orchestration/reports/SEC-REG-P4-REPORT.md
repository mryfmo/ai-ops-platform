<!-- 根拠: GOV-003 -->

# SEC-REG-P4 report

## Outcome

The exact agentgateway v1.4.1 and OPA v1.19.0-static artifacts are mapped to
their release commits and immutable image digests. Lock-derived, machine-only
license inventories and exact-image filesystem evidence are published in
[`docs/security/evidence/SEC-REG-P4`](../../docs/security/evidence/SEC-REG-P4/README.md).

Approval remains open. No Decision record field, code, dependency, image, or
deployment artifact was changed.

## Results

- agentgateway: 794 Cargo packages; 792 machine-classified and 2 explicit
  `UNKNOWN` workspace packages; 5 reciprocal/copyleft-expression candidates.
- OPA: 172 Go modules; 172 machine-classified; 1 MPL-2.0 candidate.
- Both exact image rootfs exports contain zero LICENSE/NOTICE/COPYING/COPYRIGHT
  or third-party-notice basename matches.
- Exact source LICENSE texts and all 58 image-embedded OS SPDX package
  statements are retained; 15 distinct reciprocal/copyleft-expression
  statements are surfaced separately for review.
- The register now points to the evidence and clearly separates completed
  acquisition from Owner/Legal/Security/Procurement decisions.

## Required reviewer decisions

Reviewers still decide the two agentgateway metadata UNKNOWNs, language and
image-OS candidate license expressions, attribution delivery proposal, OPA's
observed `-dirty` build suffix, image/SBOM provenance, and the
no-commercial-distribution/support boundary. This report does not imply any of
those approvals.
