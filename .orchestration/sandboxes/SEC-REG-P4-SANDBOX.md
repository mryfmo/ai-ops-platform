<!-- 根拠: GOV-003 -->

# SEC-REG-P4 sandbox record

- Repository: `/Users/mryfmo/Workspace/ai-ops-platform`
- Branch: `agent/SEC-REG-P4-license-evidence`
- Base: `adec38af679612a61f99786b5723847ea2e1954c`
- Temporary acquisition root: `/private/tmp/sec-reg-p4.L1snCn`
- External reads: upstream GitHub release/tag/commit API and repositories,
  crates.io version API, Go module proxy through pinned Go tooling, and exact
  OCI registries.
- Writes are limited to task-allowed register evidence and `.orchestration`
  paths. Temporary source checkout/tool mutations are not copied into the
  repository.
- Existing untracked `.pnpm-store/` and reference ZIP are unrelated and remain
  untouched/uncommitted.
- No Decision record, source code, dependency manifest, deploy artifact,
  approval, merge, or push operation was performed.
- The two stopped inspection containers and six task-scoped disposable CI
  databases were removed after validation. The temporary acquisition root is
  retained locally for reviewer diagnostics and is not staged.
