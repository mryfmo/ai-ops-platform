<!-- 根拠: GOV-003 -->

# P0-T06 Learning

## Validated learning

- Repository-level SPDX metadata is insufficient for mixed-license projects.
  LiteLLM reports `NOASSERTION`; its root and enterprise license files must be
  read together and matched to the exact shipped paths/artifact.
- Mutable default-branch URLs are reviewable only when paired with exact
  license-blob SHAs and an inventory date.
- A vendor's repository license, product documentation, and commercial terms
  can disagree or cover different layers. Record the discrepancy and stop for
  vendor/Legal confirmation instead of choosing the most permissive statement.
- Service/API entitlement and intended architecture are separate. Work IQ's
  public billing model does not resolve whether non-human-directed agent flows
  are allowed by its API Terms.
- An AGPL register must identify the exact modified Program, network-use,
  Corresponding Source, packaging, and integration boundary for Legal review;
  an API boundary is a proposed risk control, not a legal conclusion.

## Apply to

- Future dependency pinning/SBOM work: store exact artifact manifests, license
  texts, notices, blob/source hashes, and edition boundaries.
- GOV-003 owner/legal gate: require a controlling order/agreement and explicit
  closure evidence for every `UNKNOWN`, discrepancy, and `STOP` item.
- Future external-service reviews: separate OSS rights, hosted-service terms,
  enterprise features, data-processing terms, and support/SLA commitments.

