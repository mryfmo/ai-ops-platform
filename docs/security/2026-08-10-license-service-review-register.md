<!-- 根拠: GOV-003 -->

# License and external-service review register

Status: **OPEN — Owner/Legal/Security review input; not legal approval**

This register records the license and service-term boundaries for the products
selected by the final architecture. It does not conclude that any product or
deployment model is legally acceptable. Owner, Legal, Security, and
Procurement must close the open items before the corresponding product is
enabled outside an approved evaluation.

## Review basis

- Inventory date: **2026-08-10**
- Sources: official repositories, vendor documentation, and vendor legal pages
  listed in the final-architecture
  [Source Register](../plans/2026-08-final-architecture/SOURCE_REGISTER.md)
- Repository licenses were inspected on each repository's default branch. A
  mutable branch name is paired with the inspected license-blob SHA below.
- A repository license does not grant rights to a vendor-hosted service,
  enterprise feature, support package, trademark, or third-party component.
- `UNKNOWN` means that the public primary sources or this repository do not
  establish the answer. It must not be filled from memory or inference.
- The signed order, negotiated addendum, and version actually procured take
  precedence over a public pricing or terms page. Legal must identify that
  controlling document.

## Decision summary

| Product      | Proposed usage boundary                                                                                                                              | Verified public basis                                                                         | Gate status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Temporal     | TypeScript SDK plus self-hosted OSS server — production profile selected by ENV-DEC-001 (2026-08-11 reconciliation; no Cloud order)                  | SDK and server repositories: MIT; Cloud terms not applicable to the selected profile          | **OPEN** — profile decision closed; remaining before P3 go-live: exact pinned version/image, dependency inventory, and license-notice evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| LiteLLM      | Self-hosted OSS proxy v1.96.2（exact pin 済み。公式 image には enterprise ツリーが物理同梱 — Owner 裁定 2026-08-12 で受容し、有効化・import を禁止） | Root MIT（enterprise/ 除外）— pin tag の license blob は P0-T06 review 済み blob とバイト一致 | **OPEN** — pin/境界/Owner 裁定は記録済み。Owner 裁定 2026-08-12（option B、セッション記録）: 公式 image が litellm-enterprise（LicenseRef-Proprietary、proxy の pip 依存）を起動時に無条件 import する事実（P2-T02-002、v1.96.2 ソースで実証）を受け、デプロイ artifact を OSS-only 派生 image `ghcr.io/mryfmo/aiops-litellm-oss:v1.96.2-oss.1@sha256:c11bd714131599d5eafbdf0533ea54e017a4506f711095fa4762e341df1f36ba`（deploy/litellm/Dockerfile で base から litellm-enterprise と /app/enterprise を除去、build 時 + runtime で unimportable を機械検証）へ変更。base pin は provenance として維持。残: P2-T02 のデプロイ config 証明（enterprise 除去・該当 env/module なし・telemetry off）= binding |
| agentgateway | Self-hosted MCP/A2A gateway                                                                                                                          | Apache-2.0 repository                                                                         | **OPEN** — complete Apache notice review; do not infer hosted/support rights                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| OPA          | Self-hosted policy engine and policy bundles                                                                                                         | Apache-2.0 repository                                                                         | **OPEN** — complete Apache notice review; vendor distributions are separate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| OpenTag      | Open-source UI/tag protocol components                                                                                                               | MIT repository                                                                                | **OPEN** — retain license notices and pin the exact package/version                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| CopilotKit   | Open-source runtime/channels or separately contracted Cloud/premium features                                                                         | Core and Channels repositories: MIT; Cloud/premium: proprietary terms                         | **OPEN** — resolve the public license-description discrepancy and select OSS, Cloud, or premium boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Work IQ      | Signed-in-user delegated/OBO `read/ask/fetch` within an approved Microsoft 365 tenant; autonomous/background and app-only flows are excluded         | Proprietary API terms and usage-based service billing                                         | **OPEN / STOP** — confirm delegated-surface eligibility, tenant/license surface, OBO, data boundary, and billing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Wispr Flow   | Enterprise meeting/dictation input only under an approved order and data configuration                                                               | Proprietary service terms, MSA, and DPA                                                       | **OPEN / STOP** — approve consent, data residency/retention, Privacy Mode/Cloud Sync, and subprocessors                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Confluence   | Confluence Cloud REST access within purchased tenant scope; Rovo MCP is separate                                                                     | Proprietary Cloud/order terms, DPA, and API documentation                                     | **OPEN** — identify the controlling agreement/order and separately approve Rovo MCP if used                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Plane CE     | Self-hosted Community Edition behind a published API boundary                                                                                        | AGPL-3.0 repository; commercial editions and Cloud are separate                               | **OPEN / STOP** — Legal must approve the AGPL deployment/modification/integration boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

## Product register

### Temporal

| Field                      | Record                                                                                                                                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open-source artifacts      | `temporalio/sdk-typescript` and `temporalio/temporal`                                                                                                                                                                        |
| License                    | MIT. SDK license blob `7c6bbcaa0b092a065ce47c9fbe94beb229b1d2e0`; server license blob `3349f76795f4409cba6ae18ea56adf9fbd8346f3`                                                                                             |
| OSS obligations to verify  | Include the copyright and permission notice in copies or substantial portions; preserve the warranty disclaimer; inventory separately licensed dependencies                                                                  |
| Intended boundary          | The TypeScript SDK is an application dependency. The server is used only if the approved production profile is self-hosted. The repository licenses do not cover Temporal Cloud                                              |
| Hosted/commercial boundary | Temporal Cloud is governed by its service terms and an order. Public pricing currently lists plan, action, storage, and optional add-on charges; the order controls actual fees and commitments                              |
| Owner/Legal review         | **Decided (ENV-DEC-001, Owner 2026-08-10/11)**: self-hosted OSS minimal profile on the ADR-0029 AWS baseline; no Temporal Cloud order. Cloud-order review items are not applicable unless a future ENV-DEC reopens Cloud     |
| Unknowns                   | Resolved: production profile = self-host OSS (ENV-DEC-001); Cloud plan/SLA/DPA rows not applicable. Remaining (P3): exact pinned server/SDK versions, separately licensed dependency inventory, and retained license notices |

Primary sources:

- [Temporal TypeScript SDK license](https://github.com/temporalio/sdk-typescript/blob/main/LICENSE)
- [Temporal server license](https://github.com/temporalio/temporal/blob/main/LICENSE)
- [Temporal Cloud terms of service](https://temporal.io/terms-of-service)
- [Temporal pricing](https://temporal.io/pricing)
- [Temporal data processing agreement](https://temporal.io/images/temporal-data-processing-agreement-6-28-23.pdf)

### LiteLLM

| Field                     | Record                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Artifact                  | `BerriAI/litellm`; intended use is a self-hosted proxy/gateway                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| License                   | **Mixed/path-dependent**, not safely classifiable as repository-wide MIT. The root license says files outside an `enterprise/` directory are MIT when that directory is present. The current enterprise license permits development/testing but requires an enterprise subscription and the correct seat count for production. GitHub reports `NOASSERTION` for the repository. Root license blob `3bfef5bae9b48c334acf426d5b7f21bc1913aab9`; enterprise license blob `c8607439adfe19df15cf78a04e5964237a89b9bc`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| OSS obligations to verify | For every pinned source path and packaged artifact classified as MIT, retain the copyright and permission notice and inventory bundled dependencies                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Commercial boundary       | Enterprise security, user-management, support, SLA, and other vendor-identified enterprise features require the applicable commercial license/order for production. A repository checkout or package name alone does not prove the boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Intended boundary         | Only an exact, pinned, source-reviewed OSS proxy artifact may be evaluated. No enterprise-marked module, image, key-gated feature, or hosted offering is enabled without a commercial review                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Owner/Legal review        | Obtain the license manifest for the exact version/image; map every enabled module to OSS or commercial terms; review enterprise order, support/SLA, telemetry, DPA, subprocessors, retention, and provider pass-through obligations if applicable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Source discrepancy        | The root license points to `enterprise/LICENSE`, while the current default branch contains `enterprise/LICENSE.md`. Treat the enterprise tree as commercial and require vendor/Legal confirmation instead of resolving the filename mismatch by inference                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Unknowns                  | **P2-ENTRY (2026-08-12) で解消**: exact pin = v1.96.2（tag commit 83d6d84bfb7a、image ghcr.io/berriai/litellm:v1.96.2@sha256:154e23bb5f31b1f10e16392a8ef299bd2cde08de3a64a6849002cfcc25ce3c63）。当該 tag で root LICENSE blob 3bfef5bae9b48c334acf426d5b7f21bc1913aab9 / enterprise/LICENSE.md blob c8607439adfe19df15cf78a04e5964237a89b9bc を実測 — いずれも P0-T06 review 済み blob とバイト一致。enterprise/ 実在（cloudformation_stack/dist/enterprise_hooks/enterprise_ui/litellm_enterprise）、root LICENSE の enterprise/LICENSE 参照名齟齬は現存 → fail-closed（enterprise ツリー全体を商用扱い・不使用）。price/order・vendor SLA = 不適用（OSS のみ）。残: enabled feature set と telemetry off は P2-T02 のデプロイ config で証明。**同梱事実**: pin image の OCI config に COPY /app/enterprise /app/enterprise があり商用 enterprise ツリーを物理同梱（独立レビュー P2-ENTRY-001 で実証）。**Owner 裁定（2026-08-12、セッション記録）**: 物理同梱を受容し、enterprise 機能の有効化・import・該当 env 設定を禁止。P2-T02 のデプロイ config 証明を binding とする。**Owner 裁定改訂（2026-08-12、同日・option B）**: その後の独立レビュー（P2-T02-002）で公式 image の無条件 enterprise import が実証されたため、no-import を公式 image 上の運用で満たす案を却下し、OSS-only 派生 image（上記 aiops-litellm-oss pin）をデプロイ artifact とする。将来 enterprise 契約時は公式 image への切替 + 本 register 改訂を条件とする |

Primary sources:

- [LiteLLM repository license](https://github.com/BerriAI/litellm/blob/litellm_internal_staging/LICENSE)
- [LiteLLM enterprise license](https://github.com/BerriAI/litellm/blob/litellm_internal_staging/enterprise/LICENSE.md)
- [LiteLLM repository and Enterprise description](https://github.com/BerriAI/litellm)
- [LiteLLM proxy documentation](https://docs.litellm.ai/docs/simple_proxy)

### agentgateway

| Field                     | Record                                                                                                                                                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Artifact                  | `agentgateway/agentgateway`                                                                                                                                                                                                  |
| License                   | Apache License 2.0; license blob `f7b5e615693b3618c2d10228851355921fc4656e`                                                                                                                                                  |
| OSS obligations to verify | Ship the Apache-2.0 license; preserve required attribution and any applicable `NOTICE` content; mark modified files; preserve relevant notices; inventory dependencies; retain the license's patent and trademark boundaries |
| Intended boundary         | Self-hosted MCP/A2A access gateway. No hosted service, enterprise distribution, or paid support is assumed                                                                                                                   |
| Owner/Legal review        | Approve the exact release and dependency/SBOM record; confirm notice handling and whether any selected image, plugin, distribution, or support package adds other terms                                                      |
| Unknowns                  | Exact release/image; dependency licenses; whether commercial support or a third-party distribution will be procured                                                                                                          |

Primary sources:

- [agentgateway repository license](https://github.com/agentgateway/agentgateway/blob/main/LICENSE)
- [agentgateway documentation](https://agentgateway.dev/docs/)

### Open Policy Agent

| Field                     | Record                                                                                                                                                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Artifact                  | `open-policy-agent/opa`                                                                                                                                                                                                      |
| License                   | Apache License 2.0; license blob `8f71f43fee3f78649d238238cbde51e6d7055c82`                                                                                                                                                  |
| OSS obligations to verify | Ship the Apache-2.0 license; preserve required attribution and any applicable `NOTICE` content; mark modified files; preserve relevant notices; inventory dependencies; retain the license's patent and trademark boundaries |
| Intended boundary         | Self-hosted policy engine and policy bundles. Vendor-hosted control planes, enterprise distributions, and support are not included                                                                                           |
| Owner/Legal review        | Approve the exact release/image, SBOM, notice handling, and any separately selected distribution or support agreement                                                                                                        |
| Unknowns                  | Exact release/image; dependency licenses; whether a vendor distribution or paid support will be used                                                                                                                         |

Primary sources:

- [OPA repository license](https://github.com/open-policy-agent/opa/blob/main/LICENSE)
- [OPA documentation](https://www.openpolicyagent.org/docs/latest/)

### OpenTag

| Field                     | Record                                                                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Artifact                  | `CopilotKit/OpenTag`                                                                                                                    |
| License                   | MIT; license blob `3b2206e4a39953e65bfde70f550573d343f5b510`                                                                            |
| OSS obligations to verify | Include the copyright and permission notice in copies or substantial portions; preserve the warranty disclaimer; inventory dependencies |
| Intended boundary         | Open-source protocol/UI components only. Rights to CopilotKit Cloud or premium extensions are not inferred                              |
| Owner/Legal review        | Pin the exact package/version and verify its published package contents, dependency licenses, notices, and trademark/branding use       |
| Unknowns                  | Exact package/version and its dependency/license manifest                                                                               |

Primary source:

- [OpenTag repository license](https://github.com/CopilotKit/OpenTag/blob/main/LICENSE)

### CopilotKit core, Channels, Cloud, and premium

| Field                     | Record                                                                                                                                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OSS artifacts             | `CopilotKit/CopilotKit` and `CopilotKit/channels-sdk`                                                                                                                                                                                                               |
| Repository licenses       | MIT; core license blob `b3bf13ded443fa46a3fbbf69c42d2150c21f4cda`; Channels license blob `3b2206e4a39953e65bfde70f550573d343f5b510`                                                                                                                                 |
| OSS obligations to verify | Include the copyright and permission notice in copies or substantial portions; preserve the warranty disclaimer; inventory dependencies                                                                                                                             |
| Public-source discrepancy | The inspected repositories say MIT, while an official product page has described part of the OSS offering as Apache-2.0. The exact package/version license must be resolved from its distributed artifact and controlling license before adoption                   |
| Commercial boundary       | CopilotKit Cloud and premium extensions are governed by service/commercial terms, keys, plan limits, and possibly additional signup or order terms. Public pricing does not establish the negotiated terms                                                          |
| Intended boundary         | Select exactly one documented boundary: self-managed OSS adapter/runtime, vendor Cloud, or licensed self-hosted premium. Do not mix premium/key-gated code into the OSS boundary without an order                                                                   |
| Owner/Legal review        | Resolve the license-description discrepancy; approve the exact packages; choose self-managed versus Cloud/premium; if commercial, review order, DPA, subprocessors, data location/retention/deletion, model providers, usage limits, SLA/support, renewal, and exit |
| Unknowns                  | Selected architecture boundary; exact packages/versions; controlling license for distributed artifacts; plan/order; DPA/subprocessors; data residency/retention; SLA/support; model-provider pass-through terms                                                     |

Primary sources:

- [CopilotKit core repository license](https://github.com/CopilotKit/CopilotKit/blob/main/LICENSE)
- [CopilotKit Channels repository license](https://github.com/CopilotKit/channels-sdk/blob/main/LICENSE)
- [CopilotKit OSS versus Enterprise description](https://docs.copilotkit.ai/a2a/concepts/oss-vs-enterprise)
- [CopilotKit terms of service](https://www.copilotkit.ai/terms-of-service)
- [CopilotKit pricing](https://www.copilotkit.ai/pricing)
- [CopilotKit premium extensions](https://docs.copilotkit.ai/ms-agent-python/premium/overview)
- [CopilotKit privacy policy](https://www.copilotkit.ai/privacy-policy)

### Microsoft Work IQ

| Field                  | Record                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Service/API            | Work IQ APIs exposed through A2A, MCP, and REST within Microsoft 365                                                                                                                                                                                                                                                                                                                                                                                                        |
| License/terms          | Proprietary, revocable API access under the Work IQ API Terms and applicable Microsoft agreement. The public terms identify the APIs as preview and provide no SLA or performance commitment                                                                                                                                                                                                                                                                                |
| Billing boundary       | The current overview says API usage is usage-based and independent of a Microsoft 365 Copilot license. Other product-surface documentation has described different license prerequisites for some MCP experiences. Tenant/product-specific entitlement is therefore unresolved                                                                                                                                                                                              |
| Material restriction   | The API Terms prohibit specified non-human-directed applications, including bots or multiplexing. That language may conflict with background/autonomous agent workflows; this register does not interpret the clause                                                                                                                                                                                                                                                        |
| Data boundary          | Terms require appropriate licenses, end-user direction/consent, privacy disclosure, and compliant retention/deletion; impose restrictions on redistribution, resale, advertising, and derived uses; and distinguish single- and multi-tenant registration                                                                                                                                                                                                                   |
| Architecture exclusion | **EXCLUDED BY ARCHITECTURE:** autonomous/background Work IQ flows, app-only fallback, and autonomous Work IQ A2A delegation. [ADR-0024](../adr/0024-work-iq-graph-separation.md) assigns app-only/background work to Graph and prohibits Work IQ app-only fallback; [final-architecture exclusions](../plans/2026-08-final-architecture/00_governance/04_non_goals_and_exclusions.md) defer autonomous A2A delegation. These flows cannot be approved through this register |
| Intended boundary      | Planned production scope is signed-in-user delegated/OBO `read/ask/fetch` only. No connection until Microsoft/Legal confirms that this delegated surface, tenant model, OBO path, permission scope, and data use are permitted                                                                                                                                                                                                                                              |
| Owner/Legal review     | Scope approval to the planned delegated/OBO `read/ask/fetch` surface only. Confirm that surface complies with the non-human-directed clause; confirm tenant and API availability, preview/GA status, billing/Copilot Credits, app registration model, OBO, selected permissions, data location/retention/deletion, DPA, audit, SLA/support, and exit behavior                                                                                                               |
| Unknowns               | Eligibility of the delegated/OBO `read/ask/fetch` surface under the non-human-directed clause; controlling tenant agreement; tenant entitlement; API surface and preview status at go-live; price/credits; OBO design; permission approval; data residency/retention; DPA/subprocessors; SLA/support                                                                                                                                                                        |

Primary sources:

- [Work IQ overview](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/work-iq/)
- [Work IQ API terms of use](https://learn.microsoft.com/en-us/legal/work-iq-apis/terms-of-use)
- [Work IQ API overview](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/work-iq/api-overview)
- [Work IQ MCP overview](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/work-iq/mcp/overview)

### Wispr Flow

| Field                | Record                                                                                                                                                                                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Service              | Wispr Flow Enterprise for approved dictation/meeting capture use cases                                                                                                                                                                                                              |
| License/terms        | Proprietary, limited, revocable software/service right under the Terms, enterprise order/MSA, and DPA                                                                                                                                                                               |
| Data boundary        | Customer content can include audio, transcripts, metadata, and output. Customer must provide required notices and obtain meeting/recording consent. Privacy Mode and Cloud Sync are separate controls; `Cloud Sync off` must not be assumed merely because Privacy Mode is on       |
| AI/provider boundary | Public enterprise materials describe zero-data-retention arrangements for some model processing, but the exact order, configuration, provider list, and evidence control the deployment. AI output requires human review                                                            |
| Intended boundary    | Enterprise only, with an approved order and enforced tenant configuration. No meeting capture until consent and data-handling controls are approved and tested                                                                                                                      |
| Owner/Legal review   | Approve meeting consent policy; purpose/field allowlist; data residency, retention, deletion, and backups; Privacy Mode and Cloud Sync settings; DPA/SCCs/subprocessors; SSO/SCIM; audit access; model ZDR evidence; incident terms; SLA/support; MCP/API availability; exit/export |
| Unknowns             | Selected use cases; order and price; service region/data residency; meeting/notetaker retention; backup deletion; exact provider/ZDR evidence; SSO/SCIM tier; audit evidence; MCP/API entitlement; consent implementation; SLA/support                                              |

Primary sources:

- [Wispr Flow terms of service](https://wisprflow.ai/terms-of-service)
- [Wispr Flow enterprise MSA](https://wisprflow.ai/legal/msa)
- [Wispr Flow data processing addendum](https://wisprflow.ai/legal/dpa)
- [Wispr Flow security and compliance FAQ](https://docs.wisprflow.ai/articles/3467817258-security-and-compliance-faq)

### Atlassian Confluence

| Field              | Record                                                                                                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Service/API        | Confluence Cloud REST API within an approved tenant. Rovo MCP is a separate product surface and approval                                                                                                                                                           |
| License/terms      | Proprietary Cloud/order terms. The signed order and agreement version applicable to the customer control; the public legal archive currently labels an agreement for 2025-10-07 through 2026-08-16, while the current page announces terms effective 2026-08-17    |
| Data boundary      | Cloud processing is subject to the applicable agreement, DPA, product terms, and customer permission model. AI offerings and third-party integrations may add separate terms                                                                                       |
| Intended boundary  | Use only the published Confluence REST API, within purchased tenant/user scope and retrieval-side authorization. Do not infer Rovo MCP, AI, Marketplace app, Data Center, or cross-tenant rights                                                                   |
| Owner/Legal review | Identify the signed order and controlling archived/current agreement; approve tier, DPA, subprocessors, region/data residency, retention/deletion/backups, support/SLA, renewal, export/exit, API limits, AI terms if applicable, and a separate Rovo MCP decision |
| Unknowns           | Cloud adoption and tier; controlling agreement/order; users and fees; region/data residency; retention/backups; support/SLA; Rovo MCP eligibility and terms; AI feature state; export/exit plan                                                                    |

Primary sources:

- [Atlassian Customer Agreement](https://www.atlassian.com/legal/atlassian-customer-agreement)
- [Atlassian legal archive](https://www.atlassian.com/legal/archives)
- [Atlassian data processing addendum](https://www.atlassian.com/legal/data-processing-addendum)
- [Confluence pricing](https://www.atlassian.com/software/confluence/pricing)
- [Confluence Cloud REST API v2](https://developer.atlassian.com/cloud/confluence/rest/v2/intro/)
- [Atlassian Rovo MCP](https://www.atlassian.com/platform/rovo-mcp)

### Plane Community Edition

| Field                     | Record                                                                                                                                                                                                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Artifact                  | `makeplane/plane` Community Edition, self-hosted                                                                                                                                                                                                                                                         |
| License                   | GNU Affero General Public License v3.0; license blob `5087e61e24bce453516dd67d07aec21923271472`                                                                                                                                                                                                          |
| OSS obligations to verify | Preserve license/copyright notices and provide the required source and installation information where applicable. AGPL section 13 adds a network-interaction source obligation for a modified Program. Legal must determine the Corresponding Source and combined-work boundary for the exact deployment |
| Commercial boundary       | Plane Commercial Edition, paid self-hosted/air-gapped features, license keys, support, and Plane Cloud are separate from CE and require their own order/terms                                                                                                                                            |
| Intended boundary         | Keep an unmodified, pinned CE deployment isolated behind Plane's published API until Legal approves modifications, packaging, plugins, linked/combined components, deployment distribution, and source-offer procedures. This is a risk-control proposal, not a conclusion about AGPL scope              |
| Owner/Legal review        | Approve CE versus Commercial/Cloud; exact version/image and source archive; modification status; API/process/container boundary; Corresponding Source and network-source-offer procedure; notices; dependency licenses; trademark use; support/SLA; update and vulnerability process                     |
| Unknowns                  | Edition and exact version; whether code/config/build artifacts will be modified; combined-work boundary; source publication/offer procedure; dependency licenses; commercial alternative price/order; support/SLA                                                                                        |

Primary sources:

- [Plane Community Edition license](https://github.com/makeplane/plane/blob/preview/LICENSE.txt)
- [Plane editions and versions](https://developers.plane.so/self-hosting/editions-and-versions)
- [Plane terms and conditions](https://plane.so/legals/terms-and-conditions)
- [Plane service-level agreement](https://plane.so/legals/service-level-agreement)
- [Plane API](https://developers.plane.so/api-reference/introduction)

## Manual Owner/Legal/Security checklist

This checklist is evidence intake for GOV-003. A checked box means that the
named reviewer recorded a decision and evidence; it does not mean that this
document supplied legal advice.

### Cross-product evidence

- [ ] Owner records the selected product, edition, deployment model, exact
      version/image/package, intended users, and intended data classes.
- [ ] Legal records the controlling license, order, agreement version, DPA,
      product/AI/API terms, and any negotiated addenda.
- [ ] Procurement records price, usage unit, minimum commitment, renewal,
      termination, support/SLA, overage, and exit/export terms.
- [ ] Security records subprocessors, model providers, regions, data residency,
      retention/deletion/backups, encryption, tenant isolation, SSO/SCIM,
      audit evidence, incident notice, and vulnerability/update handling.
- [ ] Engineering stores the exact license texts, notices, source archives,
      dependency/SBOM evidence, and configuration proof for the selected
      versions.
- [ ] Owner confirms that no `UNKNOWN`, source discrepancy, or `STOP` item
      affecting the chosen boundary remains unresolved.

### Product-specific stop conditions

- [x] Temporal: production profile approved — ENV-DEC-001 (2026-08-10/11)
      selected self-hosted OSS; no Cloud order, so Cloud order/DPA/region/SLA
      review is not applicable.
- [ ] Temporal (P3 residual): exact pinned server/SDK versions, separately
      licensed dependency inventory, and retained license notices are evidenced
      before P3 go-live.
- [ ] LiteLLM: every enabled file/module/image feature is mapped to its
      controlling OSS or commercial license.
- [ ] agentgateway and OPA: exact release, dependency licenses, Apache notices,
      and any vendor distribution/support terms are approved.
- [ ] OpenTag and CopilotKit: exact package licenses are verified; the MIT versus
      Apache public-description discrepancy is resolved; OSS versus
      Cloud/premium is selected.
- **EXCLUDED BY ARCHITECTURE — not approvable through this checklist:** Work IQ
  autonomous/background flows, app-only fallback, and autonomous A2A
  delegation. App-only/background work belongs to Graph under
  [ADR-0024](../adr/0024-work-iq-graph-separation.md), and autonomous A2A remains
  deferred by the
  [final-architecture exclusions](../plans/2026-08-final-architecture/00_governance/04_non_goals_and_exclusions.md).
- [ ] Work IQ: Microsoft/Legal confirms only the planned signed-in-user
      delegated/OBO `read/ask/fetch` surface complies with the
      non-human-directed clause, and its tenant, OBO, permissions, billing, and
      data terms are approved.
- [ ] Wispr: consent, Privacy Mode, Cloud Sync, meeting retention, DPA,
      subprocessors, residency, SSO/SCIM, and model ZDR evidence are approved.
- [ ] Confluence: the controlling agreement/order is identified; Cloud/API
      boundary is approved; Rovo MCP and AI remain off unless separately
      approved.
- [ ] Plane: Legal approves CE's exact AGPL deployment/modification/integration
      and source-compliance boundary, or Procurement approves a commercial
      alternative.

## Decision record

The approvers complete this table outside the task PR or in a follow-up
approval artifact. P0-T06 intentionally leaves every decision open.

| Role        | Reviewer | Decision/evidence | Date    | Status |
| ----------- | -------- | ----------------- | ------- | ------ |
| Owner       | UNKNOWN  | UNKNOWN           | UNKNOWN | OPEN   |
| Legal       | UNKNOWN  | UNKNOWN           | UNKNOWN | OPEN   |
| Security    | UNKNOWN  | UNKNOWN           | UNKNOWN | OPEN   |
| Procurement | UNKNOWN  | UNKNOWN           | UNKNOWN | OPEN   |
