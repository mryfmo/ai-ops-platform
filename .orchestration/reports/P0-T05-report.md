<!-- 根拠: PrjOps:REQ-030 / PrjOps:REQ-041 / PrjOps:REQ-042 -->

# P0-T05 Report

- Branch: `agent/P0-T05-perf-baseline`
- Base: `e41e6e67cf5f42b70b8aa0b15c2b2266fcdd3862`
- Base tree: `7321c5a2b40078921496ec145e2526fbd7b87562`
- Pull request: https://github.com/mryfmo/ai-ops-platform/pull/155
- Acceptance dependency: `GOV-001`
- Deliverable: `verification/2026-08-10-performance-reliability-baseline.md`

- Re-ran and recorded the existing 100-project/2,000-recipient functional baseline on the current toolchain.
- Measured local API functional paths and real loopback PostgreSQL latency/connection stability.
- Kept real Anthropic and Microsoft Graph latency explicitly `ENV-blocked`; neither was claimed green.
- Identified that the WBS/root load commands no longer narrow the Vitest 4 test selection after `--`; direct targeted Vitest commands produced the metric evidence without changing implementation or dependencies.
- Completed `mise run ci` against clean task-owned PostgreSQL databases: exit 0 in approximately 60 seconds, 182 test files, 2,274 passed, 0 skipped, and `P001 PostgreSQL integration passed`.
- Made no implementation, dependency, production configuration, or external-service mutation.
