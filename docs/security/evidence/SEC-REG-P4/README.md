<!-- 根拠: GOV-003 -->

# SEC-REG-P4 license evidence pack

Status: **EVIDENCE COMPLETE — APPROVAL REMAINS OPEN**

This pack records machine-acquired release, dependency-license, and container
filesystem evidence for the exact agentgateway and OPA artifacts selected by
the repository. It is not legal advice and does not record Owner, Legal,
Security, or Procurement approval.

## Exact artifact correspondence

| Product      | Selected image                                                                                                        | Upstream release                                                                                   | Source commit                                                                                                                              | Machine correspondence                                                                                                                                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| agentgateway | `ghcr.io/agentgateway/agentgateway:v1.4.1@sha256:efd79355b89094a8225a9db465d9a01dc656b377f0bab458761b935a13231d29`    | [`v1.4.1`](https://github.com/agentgateway/agentgateway/releases/tag/v1.4.1), published 2026-07-29 | [`163ea2146acb7b82082acea30ed691b29079095f`](https://github.com/agentgateway/agentgateway/commit/163ea2146acb7b82082acea30ed691b29079095f) | OCI labels report version `v1.4.1`, revision `163ea214…`, source repository, and `Apache-2.0`; runtime `--version` reports `1.4.1` and the same revision                                                                                       |
| OPA          | `docker.io/openpolicyagent/opa:1.19.0-static@sha256:2f42ca765bb739b40fc23ee625b3287012acdf8120ad4fcbdab68433a17be144` | [`v1.19.0`](https://github.com/open-policy-agent/opa/releases/tag/v1.19.0), published 2026-07-30   | [`1e32c796e8979b1bda2f768138500b1deb95ff24`](https://github.com/open-policy-agent/opa/commit/1e32c796e8979b1bda2f768138500b1deb95ff24)     | OCI history copies `_release/1.19.0/opa_linux_*_static`; runtime reports version `1.19.0` and build commit `1e32c796…-dirty`. The suffix is retained as observed, so reviewers can decide whether the release/tag correspondence is sufficient |

The selected image digests match
[`deploy/agentgateway/deployment.yaml`](../../../../deploy/agentgateway/deployment.yaml)
and [`deploy/opa/deployment.yaml`](../../../../deploy/opa/deployment.yaml). The
repository release inputs have these SHA-256 values:

| Input                                    | SHA-256                                                            |
| ---------------------------------------- | ------------------------------------------------------------------ |
| agentgateway `Cargo.lock` at `163ea214…` | `0693d44308718cb56cc2b238bad19ae3b8ca12cba5c99d39dbb240d6a4f8f156` |
| OPA `go.mod` at `1e32c796…`              | `acb6b1890ce9d51dc6956b8d6b65b02085b169f89560d3ec03f6cf43c0c460d7` |
| OPA `go.sum` at `1e32c796…`              | `8f31e6e4ebdb2de42078d7006193e3babce208f852b2621f5bec21814dd9d11b` |

## Dependency inventory result

| Product      | Lock-derived population | UNKNOWN | Language-dependency review candidates | Evidence                                                                                                                                            |
| ------------ | ----------------------: | ------: | ------------------------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| agentgateway |      794 Cargo packages |       2 |                                     5 | [inventory](agentgateway-cargo-inventory.tsv), [license counts](agentgateway-license-summary.tsv), [candidates](agentgateway-review-candidates.tsv) |
| OPA          |          172 Go modules |       0 |                                     1 | [inventory](opa-go-inventory.tsv), [license counts](opa-license-summary.tsv), [candidates](opa-review-candidates.tsv)                               |

The two agentgateway `UNKNOWN` records are workspace/path packages
`agent-xds 0.0.0` and `xtask 0.0.0`: their package manifests return no license
through Cargo metadata. The repository root supplies an Apache-2.0 license,
but this pack does not infer a package license from it. Legal must make that
mapping or require package metadata. Candidate lists are search results for
reciprocal/copyleft expressions, not compatibility conclusions; `OR`
expressions are preserved exactly.

The exact upstream license texts are retained as
[agentgateway-LICENSE.txt](agentgateway-LICENSE.txt) (SHA-256
`3b1ee5b1e14fda40515c18ec2f0796d632e65a20b2aca8f017c654bc26ca77bd`)
and [opa-LICENSE.txt](opa-LICENSE.txt) (SHA-256
`c6596eb7be8581c18be736c846fb9173b69eccf6ef94c5135893ec56bd92ba08`).

## Container and attribution result

[Container filesystem evidence](container-filesystem-evidence.md) records the
exact rootfs export and runtime observations. Neither exact image contains a
path whose basename identifies a `LICENSE`, `NOTICE`, `COPYING`, `COPYRIGHT`,
or third-party notice file. Both images do contain machine-readable OS-package
SPDX records, preserved in the
[OS package inventory](container-os-package-inventory.tsv). The 15 distinct
SPDX statements matching reciprocal/copyleft expressions are listed separately
as [OS review candidates](container-os-review-candidates.tsv), without merging
parenthesized expressions or reaching a compatibility conclusion. Absence from
the image is evidence about packaging only; it does not remove an attribution
or license-text obligation.

Proposed deployment-ledger entry for each distributed digest:

1. Bind the exact digest, upstream commit, and source-license SHA-256 above.
2. Bundle the matching upstream license text, dependency inventory, review
   candidate disposition, and image OS-package SPDX inventory with the
   deployment release record.
3. Record `upstream NOTICE: absent` and `image NOTICE: absent` as observations;
   retain any dependency or downstream-added NOTICE content when Legal
   determines it applies.
4. Record modification status and the party responsible for attribution
   delivery. Re-run the inventory whenever the digest or lockfile changes.

This is a proposal for the deploy ledger; no deploy artifact is changed by
SEC-REG-P4.

## Self-hosted OSS / commercial confirmation

The selected repository configuration runs the public OSS images locally and
does not configure a vendor-hosted control plane. Before approval, the named
reviewers still must confirm and record:

- Owner: only these exact images and self-hosted functions are selected; no
  enterprise plugin, hosted feature, or trademark/branding grant is assumed.
- Procurement: no paid distribution, subscription, support, SLA, or order is
  being relied on; if one exists, identify its controlling terms and price.
- Legal: approve the exact dependency expressions, the two explicit UNKNOWN
  workspace records, 15 image-OS SPDX candidate statements, license/NOTICE
  delivery, modification marking, patent terms, and trademark boundary.
- Security: approve image provenance, update/vulnerability ownership, SBOM
  retention, and the operational boundary for community support only.

## Reproduction

Reproduction commands, tool versions, count assertions, and immutable hashes
are in
[`SEC-REG-P4-VALIDATION.md`](../../../../.orchestration/validation/SEC-REG-P4-VALIDATION.md).
