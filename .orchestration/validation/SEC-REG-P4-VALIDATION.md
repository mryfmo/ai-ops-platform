<!-- 根拠: GOV-003 -->

# SEC-REG-P4 validation

## Reproduction inputs

```text
agentgateway commit: 163ea2146acb7b82082acea30ed691b29079095f
agentgateway Cargo.lock sha256: 0693d44308718cb56cc2b238bad19ae3b8ca12cba5c99d39dbb240d6a4f8f156
agentgateway image: ghcr.io/agentgateway/agentgateway:v1.4.1@sha256:efd79355b89094a8225a9db465d9a01dc656b377f0bab458761b935a13231d29

OPA commit: 1e32c796e8979b1bda2f768138500b1deb95ff24
OPA go.mod sha256: acb6b1890ce9d51dc6956b8d6b65b02085b169f89560d3ec03f6cf43c0c460d7
OPA go.sum sha256: 8f31e6e4ebdb2de42078d7006193e3babce208f852b2621f5bec21814dd9d11b
OPA image: docker.io/openpolicyagent/opa:1.19.0-static@sha256:2f42ca765bb739b40fc23ee625b3287012acdf8120ad4fcbdab68433a17be144
```

## Machine acquisition commands

The following command shape reproduces the source and image inputs. Use an
empty temporary directory and do not substitute mutable default branches for
the commits.

```sh
git clone --filter=blob:none https://github.com/agentgateway/agentgateway.git agentgateway
git -C agentgateway checkout 163ea2146acb7b82082acea30ed691b29079095f
git clone --filter=blob:none https://github.com/open-policy-agent/opa.git opa
git -C opa checkout 1e32c796e8979b1bda2f768138500b1deb95ff24

container image inspect ghcr.io/agentgateway/agentgateway:v1.4.1@sha256:efd79355b89094a8225a9db465d9a01dc656b377f0bab458761b935a13231d29
container image inspect docker.io/openpolicyagent/opa:1.19.0-static@sha256:2f42ca765bb739b40fc23ee625b3287012acdf8120ad4fcbdab68433a17be144
container run --rm ghcr.io/agentgateway/agentgateway:v1.4.1@sha256:efd79355b89094a8225a9db465d9a01dc656b377f0bab458761b935a13231d29 --version
container run --rm docker.io/openpolicyagent/opa:1.19.0-static@sha256:2f42ca765bb739b40fc23ee625b3287012acdf8120ad4fcbdab68433a17be144 version

container create --name sec-reg-p4-agentgateway ghcr.io/agentgateway/agentgateway:v1.4.1@sha256:efd79355b89094a8225a9db465d9a01dc656b377f0bab458761b935a13231d29
container export --output agentgateway-image.tar sec-reg-p4-agentgateway
container create --name sec-reg-p4-opa docker.io/openpolicyagent/opa:1.19.0-static@sha256:2f42ca765bb739b40fc23ee625b3287012acdf8120ad4fcbdab68433a17be144
container export --output opa-image.tar sec-reg-p4-opa

tar -tf agentgateway-image.tar | awk -F/ 'tolower($NF) ~ /^(license|notice|copying|copyright|third[-_]?party)/'
tar -tf opa-image.tar | awk -F/ 'tolower($NF) ~ /^(license|notice|copying|copyright|third[-_]?party)/'
```

agentgateway dependency licenses were acquired with `cargo metadata` using
the release toolchain (`rustc/cargo 1.97.0`) and exact Cargo.lock. Six
target-conditional lock entries omitted from arm64 metadata were queried at
`https://crates.io/api/v1/crates/{name}/{version}`. No missing value was filled
from memory.

OPA modules were acquired with pinned `golang:1.25.0-alpine`:

```sh
/usr/local/go/bin/go mod download -json all
/usr/local/go/bin/go run github.com/google/go-licenses@v1.6.0 csv ./...
```

The 172 downloaded module roots were classified using the same
`go-licenses v1.6.0` classifier at confidence `0.8`. License-file bytes and
SHA-256 values are recorded per module. The source checkout's `go.sum` was
hashed before tool execution; `go mod download` can add missing sums to a
writable checkout, so reproduction must discard that working-tree mutation.
Raw `h1:` values are not duplicated in the inventory because staged gitleaks
classifies a valid module checksum as a generic API key; the pristine `go.sum`
SHA-256 above binds the complete checksum source without weakening scanning.

## Assertions

| Check | Result |
| --- | --- |
| Cargo inventory rows equal Cargo.lock packages | PASS — 794 = 794 |
| Cargo license summary total | PASS — 794 |
| Cargo UNKNOWN explicitly enumerated | PASS — 2 (`agent-xds`, `xtask`) |
| Go inventory rows equal `go mod download -json all` records | PASS — 172 = 172 |
| Go license summary total | PASS — 172 |
| Go UNKNOWN explicitly enumerated | PASS — 0 |
| agentgateway rootfs notice-name matches | PASS — 0 across 149 entries |
| OPA rootfs notice-name matches | PASS — 0 across 1,339 entries |
| Image-embedded SPDX statements retained | PASS — 58 rows |
| Image-OS reciprocal/copyleft-expression statements surfaced | PASS — 15 distinct rows |
| Decision record block byte hash unchanged | PASS — `b19b090ac2b5e764918b23161af1abd4363c23cc2b5c59f87e759759d041ac47` |
| Diff remains within allowed paths | PASS — register, `docs/security/evidence/**`, and `.orchestration/**` only |
| `mise run ci` | PASS — exit 0 on fresh task-scoped PostgreSQL databases |
| Pinned gitleaks v8.30.1 staged scan | PASS — no leaks found |
| Review gate | NOT AVAILABLE — repository has no `require-crit-review` make target; staged diff was reviewed directly |

`git diff --cached --check` passes for every generated artifact except the
retained upstream OPA LICENSE bytes: that exact file intentionally ends with a
blank line, and its recorded SHA-256 matches the release source. It was not
rewritten merely to silence a whitespace diagnostic.

The first CI attempt reused the existing `aiops_test` database and failed in
two server suites because its legacy `audit_log` table was not partitioned.
That was test-state contamination, not a source failure. A complete rerun from
the first CI stage against fresh `sec_reg_p4_test`, `sec_reg_p4_load`, and
`sec_reg_p4_p001` databases passed with exit 0. The repository's expected
negative PostgreSQL error probes still appeared and the integration script
ended `P001 PostgreSQL integration passed`.

## Committed evidence hashes

```text
agentgateway-cargo-inventory.tsv  ed41897557c9eb0604b9f46938e0520d6866d01bcb2c4bc1e904cb9fe53f8a5f
opa-go-inventory.tsv               1f5f1fe872af96419bfd023d932840377830b75d95d5e1776553e0d12960174a
container-os-package-inventory.tsv c51f1b10cc102e9ce49a3e8ccbdb65e9ae92d556056d6500996793a639007d7d
container-os-review-candidates.tsv de6bbbc028a96ffba81df140ead5d27fb69297af23182c0536c6e0a787c69605
```
