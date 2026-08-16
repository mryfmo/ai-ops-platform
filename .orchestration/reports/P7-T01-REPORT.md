# P7-T01 Channel Teams Scaffold Report

## Outcome

Added the dependency-free `@aiops/channel-teams` workspace package as a replaceable, stateless presentation adapter boundary. The package normalizes Teams transport input into channel-neutral values and defines the AG-UI request, client, event, authoritative mapping lookup, recoverable error, and dedupe contracts needed by later wiring tasks.

## Boundary

- The public `ChannelAdapter` contains only `source` and `normalize`; it exposes no persistence or business-state mutation API.
- The Teams adapter is frozen and accepts `unknown` at the transport trust boundary. Teams-specific envelope details remain private to the adapter module.
- Conversation/workflow mappings are supplied by `ConversationMappingAuthority`; this package provides no storage implementation or cache.
- AG-UI requests carry conversation ID, thread ID, workflow ID, neutral user identity, attachment references, source message identity, and input text.
- Mapping address mismatches fail closed with a fixed recoverable E-code. Invalid Teams input also returns a fixed non-reflective recoverable error.
- Dedupe keys use a collision-safe JSON encoding of source and platform message ID.

## Scope

No Control API connection, Teams/Bot Framework SDK, credential, network client, business-state store, external dependency, OpenTag agent/control-plane adoption, or PR #244 file was added or changed. The existing `packages/*` workspace glob required no `pnpm-workspace.yaml` edit; the approved empty lockfile importer is the only workspace registration hunk outside the new package.
