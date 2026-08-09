# 目標アーキテクチャ

## 論理構成

```mermaid
flowchart TB
  U[利用者: 経営/PM/開発/運用] --> T[Teams]
  U --> W[Next.js AI Workbench]
  U --> GHU[GitHub / Plane / Confluence / SharePoint]

  T --> CH[OpenTag-derived Teams Channel Adapter]
  CH --> API[AI Control API]
  W --> API
  GHU --> API

  API --> TEMP[Temporal]
  API --> LEDGER[(PostgreSQL Ledger)]
  TEMP --> OPA[OPA Policy]
  TEMP --> ROUTER[Task/Agent Router]

  ROUTER --> LLM[LiteLLM: inference only]
  LLM --> BR[Amazon Bedrock: default]
  LLM --> AN[Anthropic API: controlled path]

  ROUTER --> AGW[agentgateway: MCP/A2A only]
  AGW --> WI[Work IQ MCP if OBO-conformant]
  AGW --> WM[Wispr MCP]
  AGW --> PM[Plane MCP/API adapter]
  AGW --> GM[GitHub MCP read/investigation]
  AGW --> CM[Confluence MCP]

  ROUTER --> GRAPH[Microsoft Graph deterministic path]
  ROUTER --> RUNNER[GitHub Actions / Ephemeral Runner]
  RUNNER --> CC[Claude Code]
  RUNNER --> DR[Droid]
  CC --> PR[Branch / Pull Request]
  DR --> PR
  PR --> GH[GitHub]

  TEMP --> OTEL[OpenTelemetry]
  API --> OTEL
  LLM --> OTEL
  AGW --> OTEL
  RUNNER --> OTEL
```

## アーキテクチャ上の境界

### Control Plane

Temporalは業務処理の状態、timer、retry、approval、compensationを保持する。Hono serverは認証、request validation、webhook ingress、Temporal start/signal/query、read model APIに限定する。

### Inference Plane

LiteLLMだけがBedrock/Anthropicへ接続する。application、Web、Claude Code、Droidは論理model aliasとVirtual Keyだけを知る。

### Access Plane

agentgatewayだけがMCP/A2A serverを公開する。ToolをControl API、Claude/Droid、Workbenchへ直接ばらまかない。

### M365 Plane

Work IQはdelegated user intelligence。Graphはsystem integration。Work IQとGraphを一つのgeneric clientに統合しない。

### User Surface

Teams adapterとWeb Workbenchは交換可能なpresentation layer。workflow state、policy、SoR logicを持たない。

## 既存14エージェントの移行

既存PrjOps/DevOps agentは廃止せず、次の形へ変換する。

```text
現行 agents/*.ts
  ├─ deterministic decision -> 既存libをそのまま利用
  ├─ external read/write -> Temporal Activity + integration adapter
  ├─ LLM call -> LiteLLM adapter
  ├─ long wait/retry -> Temporal Workflow
  └─ user approval -> Approval child workflow / signal
```

Agent名は業務能力として維持してよいが、各agentが独自loop、独自DB state、独自provider keyを持つ構成は廃止する。
