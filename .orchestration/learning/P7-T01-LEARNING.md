# P7-T01 Learning

## Reusable Findings

1. A replaceable channel boundary stays vendor-neutral when transport parsing accepts `unknown` inside the concrete adapter and only normalized IDs/references cross the public interface.
2. No-business-state is easiest to verify when the runtime adapter is a frozen two-member value and server mapping authority is represented only by an injected lookup contract.
3. pnpm v11 records even a dependency-free workspace package as an empty lockfile importer; frozen installation therefore requires the corresponding lockfile hunk.

## Apply To

- P7-T02..T05 channel wiring, future non-Teams channel adapters, and workspace package scaffolds validated with frozen pnpm installs.
