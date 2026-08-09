# Runtime / Deployment Architecture

## Production baseline

既存Accepted ADRに従い、Azure managed platformを維持する。

- Azure Front Door Premium + WAF
- Azure Container Apps: Control API、Web、Teams adapter、Temporal workers、integration workers、LiteLLM、agentgateway、OPA sidecar/service、OTel Collector
- Azure Database for PostgreSQL: business ledger、既存DB、LiteLLM metadata。論理DB/role/schemaを分離
- Azure Key Vault + managed identities
- Azure Container Registry、immutable digest、SBOM/provenance
- Application Insights / Log Analyticsまたは承認済みOTel backend
- Microsoft Entra ID

## Temporal service選択

### Default production profile

Temporal Cloudをserver planeとして利用し、WorkersをAzure Container Appsで稼働する。理由は、Temporal serverのstateful multi-service運用を既存Container Apps基盤へ無理に持ち込まないためである。

### Strict self-host profile

組織規程がSaaS利用を禁止する場合のみTemporal OSSをAKSへ配置する。Container AppsへTemporal server一式を独自配置する案はbaselineにしない。Profile選択は`ENV-DEC-001`としてOwnerが確定し、実装者は独自変更しない。

## Cross-cloud Bedrock access

- LiteLLMはAzure private environmentに配置。
- AWS Bedrockへは短寿命credentialを使用する。長期AWS access keyをcontainer envへ固定しない。
- 優先: federated workload identity / STS AssumeRole。
- 一時的なfallbackとしてKey Vault secretを使う場合は期限、rotation、監査、移行期限を必須化。
- Anthropic API keyはKey Vaultで管理し、LiteLLM以外へ配布しない。
- egressはBedrock/Anthropic/必要SaaSのみallowlist。

## Environment separation

- dev/staging/prodでEntra app、managed identity、Key Vault、DB、Temporal namespace、LiteLLM virtual keys、agentgateway registry、GitHub Environmentを分離。
- production dataをdevへ複製しない。
- stagingは実providerの低budget tenant/accountでcontract testを実行。

## Service decomposition

| Service | State | Scaling | Public ingress |
|---|---|---|---|
| Control API | stateless | HTTP concurrency | Front Door経由のみ |
| Web | session externalized | HTTP concurrency | Control API proxy経由 |
| Teams Channel Adapter | connection/session externalized | channel load | CopilotKit/Teams経路のみ |
| Temporal Worker | workflow stateはTemporal | task queue | なし |
| LiteLLM | DB/Redis | request rate | internal only |
| agentgateway | config/registry externalized | tool traffic | internal only |
| OPA | policy bundle | low latency | internal only |
| OTel Collector | queue/buffer | telemetry rate | internal only |

## Local development

- Mac 64GB: composeによるPostgreSQL、Temporal dev server、LiteLLM、agentgateway、OPA、OTel、mock connectors。
- Windows 16GB: browser/Teams/IDE/client中心。全serverを同時local実行しない。remote dev stackを標準にする。
