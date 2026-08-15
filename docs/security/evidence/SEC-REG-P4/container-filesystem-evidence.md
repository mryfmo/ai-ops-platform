<!-- 根拠: GOV-003 -->

# Exact-image filesystem and runtime evidence

Observed 2026-08-15 on an arm64 runner. Both images were addressed by full tag
and digest. The rootfs archives are temporary validation inputs and are not
committed because the immutable image digest is the distribution identity.

| Product      | OCI index digest                                                          | Inspected variant(s)                                                                                                                                                         | Export evidence                                                                                                     |
| ------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| agentgateway | `sha256:efd79355b89094a8225a9db465d9a01dc656b377f0bab458761b935a13231d29` | linux/arm64 `sha256:be670389d56f5c70ba70767085c406a64e4a84c78343336e6d15aa298a27f3bc`                                                                                        | 149 tar entries; archive SHA-256 `48f04eeab59bfc5b55486b515d2321353ea71b6564f689115d81f75a575dff84`                 |
| OPA          | `sha256:2f42ca765bb739b40fc23ee625b3287012acdf8120ad4fcbdab68433a17be144` | linux/amd64 `sha256:c192de4f94507587a0a5e721aac8c517cb74b8f9771a76db2901c09ecb2299d3`; linux/arm64 `sha256:d19efb8ec2026ffb2ada2e3cf3f0646a3cf437a1dd32959dce78a1518769440c` | arm64 export: 1,339 tar entries; archive SHA-256 `b840c6541c2834a22ad52271ac79b83f19add3e4ffa79c103d1853e7a18adb86` |

## LICENSE / NOTICE search

The exported rootfs member names were matched case-insensitively on basename
against `LICENSE*`, `NOTICE*`, `COPYING*`, `COPYRIGHT*`, and `third-party*`.
Result: **0 matching paths for agentgateway; 0 matching paths for OPA**.

The exact source trees at the release commits contain root `LICENSE` files and
no `NOTICE` file within three levels. agentgateway additionally contains an
MIT license under `crates/pool/LICENSE`; dependency metadata, rather than that
single file, is the inventory basis.

## Runtime output

agentgateway:

```json
{
  "version": "1.4.1",
  "git_revision": "163ea2146acb7b82082acea30ed691b29079095f",
  "rust_version": "1.97.0",
  "build_profile": "release",
  "build_target": "aarch64-unknown-linux-gnu"
}
```

OPA:

```text
Version: 1.19.0
Build Commit: 1e32c796e8979b1bda2f768138500b1deb95ff24-dirty
Build Timestamp: 2026-07-30T19:38:54Z
Go Version: go1.26.5
Platform: linux/arm64
Rego Version: v1
WebAssembly: available
```

The OPA `-dirty` suffix is an observed build string. This evidence does not
reinterpret it or turn source/tag correspondence into an approval.

## Embedded machine records

agentgateway carries seven `/var/lib/db/sbom/*.spdx.json` files (ca-certificates,
glibc, glibc locale, dynamic loader, GCC runtime libraries, and Wolfi base).
OPA carries three (ca-certificates, tzdata, and Wolfi base). All 58 SPDX
package statements, including `NOASSERTION`, are copied without legal inference
to [container-os-package-inventory.tsv](container-os-package-inventory.tsv).
The 15 distinct matching license statements are surfaced for disposition in
[container-os-review-candidates.tsv](container-os-review-candidates.tsv).
