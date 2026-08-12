# P2-T08 Learning

- Anthropic's documented LiteLLM gateway authentication shape is `ANTHROPIC_BASE_URL` plus `ANTHROPIC_AUTH_TOKEN`; the latter sends the scoped gateway token as authorization rather than requiring a provider key.
- A Claude Code key restricted to one logical alias also requires the small/fast model selector to use that same alias, otherwise background requests can attempt a model outside the key scope.
- A dummy-upstream 404 after LiteLLM reports `Received Model Group=claude-code`, paired with a 403 negative alias probe, is sufficient local evidence of routing and key enforcement without using provider credentials.
- `send.sh` positional order is `team from to message`; verify its success line names the intended recipient and team before treating an AGMSG result as delivered.
