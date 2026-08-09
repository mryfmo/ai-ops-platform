# Component Spec: OpenTag-derived Teams Channel

## Adopt

- managed Teams/Slack Channel pattern
- mention/thread subscription
- file-aware prompt
- cards/tables/charts/diagram/incident/approval UI
- AG-UI boundary
- recoverable error reporting

## Do not adopt

- OpenTag標準OpenAI/LangGraph agent
- OpenTag内のMCP connection ownership
- OpenTagのin-memory stateをworkflow正本にすること
- OpenTag approvalだけでGitHub/SharePoint/production操作を確定すること

## Integration

`packages/channel-teams`はAG-UI clientとしてControl API/streaming endpointへ接続する。Conversation ID、thread ID、user identity、attachment refs、workflow IDをmappingする。

## Coexistence with Graph

- OpenTag channel: direct conversational interaction、rich UI、approval surface。
- Graph: full channel/meeting event、background ingestion、deterministic send/write。
- 同じmessageを二重処理しないようsource + platform message IDでdedupe。

## Rollout

1. read-only status query
2. workflow start with confirmation
3. approval cards
4. coding task/incident result cards
5. write actionsはTemporal/official API pathのみ

CopilotKit Intelligenceの利用はsecurity/DPA/tenant review gateを通す。承認されない場合は同じControl API contractをMicrosoft-native adapterへ実装し、Control Planeは変更しない。
