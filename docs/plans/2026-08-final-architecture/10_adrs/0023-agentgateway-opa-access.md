# ADR-0023: agentgatewayとOPAを統制付きMCP/A2A Access Planeに採用する

## Status
Accepted proposal.

## Decision
agentgatewayはMCP/A2Aのauth、routing、rate limit、OTel、tool federationを担当し、LLM routingは使わない。OPAはactor/project/classification/tool/operation/environmentを評価し、allow/deny/approval/redaction/provider制約を返す。default denyとする。

## Security boundary
MCPにはread/explore/draft/low-risk operationだけを公開し、merge/deploy/delete/permission/retention/prod DBを公開しない。token passthroughを禁止する。
