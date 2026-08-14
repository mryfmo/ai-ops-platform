# P4-T02 Learning

- Keep registry validation/rendering pure inside the integrations package and
  place filesystem/YAML CLI concerns in contracts tooling. This preserves the
  existing dependency boundary without adding a package or exception.
- Hash a recursively key-sorted parsed schema, not source bytes, so formatting
  alone does not masquerade as contract drift while semantic changes still
  require approval.
- Agentgateway MCP authorization must bind caller, target, and tool name; tool
  name alone is ambiguous across multiple servers.
- Replace only explicit generated markers. Whole-file generation would expand
  the blast radius into the independently governed JWT and A2A configuration.
