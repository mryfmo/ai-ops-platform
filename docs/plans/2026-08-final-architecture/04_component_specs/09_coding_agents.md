# Component Spec: Claude Code / Droid / Codex collaboration

## Roles

- Claude Code Fable-5 xhigh: cross-cutting architecture-aware implementationの既定Writer。
- Codex GPT-5.6 Sol high: independent verifier、contract/test/isolated implementationのWriter。
- Droid: production coding workerとしてClaude Codeと同じtask contractに従う。

Model名は利用者が指定したexecution profile labelであり、リポジトリ内ではcapability assumptionsをハードコードしない。

## One Writer protocol

Task manifestに`writer`と`reviewer`を固定。Writerのbranchが作成された後、Reviewerはread-only review branch/contextを使う。Reviewer修正が必要ならtaskを返却し、Writerが修正する。Reviewerが直接修正する場合はWriter roleを明示的に再割当し、新commit rangeを記録する。

## Runner environment

- exact pinned CLI/version/digest
- LiteLLM scoped virtual key
- agentgateway endpoint + allowlisted MCP profile
- no master key/provider key
- allowed/forbidden paths
- max runtime/cost/tokens/tool calls
- no direct production network
- clean checkout/worktree

## Task completion callback

- commands executed
- test results
- skipped/failed checks
- changed paths
- commit/branch/PR
- dependency changes
- security findings
- unresolved decisions

## Review dimensions

spec compliance、architecture drift、security、correctness、idempotency、test adequacy、observability、migration/rollback、documentation/traceability。
