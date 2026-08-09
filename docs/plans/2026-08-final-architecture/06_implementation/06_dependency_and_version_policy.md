# Dependency and Version Policy

## 1. 原則

- `latest`, floating major/minor, unpinned action、unverified container tagをproductionで使わない。
- npm/pnpm dependencyはexact pinを基本とし、lockfileを必ずcommitする。
- GitHub Actionsはcommit SHA pin。
- containerはimage digest pin + SBOM + provenance + vulnerability scan。
- CLIはexact versionとchecksum/digestを固定する。
- package installation時のlifecycle scriptを最小化し、provider secretをinstall stepへ渡さない。

## 2. 導入対象と所有者

| Dependency | Role | Owner | Prohibited overlap |
|---|---|---|---|
| Temporal SDK/server/profile | durable workflow | Control Plane owner | in-process schedulerを最終状態にしない |
| LiteLLM | inference only | AI Platform owner | MCP/A2Aを有効化しない |
| agentgateway | MCP/A2A only | Security/Access owner | LLM provider routingを設定しない |
| OPA | policy decision | Security owner | SoR permissionsを置換しない |
| Work IQ | delegated M365 intelligence | M365 owner | app-only/background用途に使わない |
| OpenTag/CopilotKit parts | Teams UX | Product/M365 owner | workflow state/SoRを持たせない |

## 3. Upgrade process

1. upstream release note、security advisory、licenseを確認。
2. test matrixを更新。
3. compatibility branchでbuild/unit/contract/E2E/replayを実行。
4. SBOM/provenanceを保存。
5. staging canary。
6. signed decisionでproduction rollout。
7. previous digest/versionをrollback window中保持。

## 4. 特別な互換試験

- LiteLLM: Anthropic Messages、Bedrock translation、tool use、streaming、thinking headers、Claude Code compatibility。
- Temporal: workflow replay、SDK/server compatibility、worker versioning。
- agentgateway: MCP protocol version、OAuth/OBO audience、tool schema、streamable HTTP、OTel。
- Work IQ: tenant issuer、delegated/OBO、permission trimming、source references、Copilot Credits。
- Claude Code/Droid: CLI version、permission mode、gateway base URL、MCP allowlist、worktree/branch behavior。

## 5. Supply-chain gates

- internal registry/mirror経由
- gitleaks/secret scan
- license allowlist
- critical/high CVE policy
- npm package integrity/lockfile validation
- container signature verification
- dependency confusion protection
- installation script review for privileged packages
