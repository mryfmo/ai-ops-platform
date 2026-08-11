# T08 Sandbox

## Repository

- Path: `/Users/mryfmo/Workspace/ai-ops-platform`
- Base branch: `main`
- Work branch: `agent/T08`
- PR: https://github.com/mryfmo/ai-ops-platform/pull/5

## Commands Run

- `~/.agents/skills/agmsg/scripts/inbox.sh /Users/mryfmo codex`
- `git pull --ff-only origin main`
- `git switch -c agent/T08`
- `mise exec -- pnpm --filter @aiops/shared add exceljs --network-concurrency 1 --fetch-retries 5 --fetch-retry-mintimeout 20000 --fetch-timeout 120000`
- `mise exec -- pnpm --filter @aiops/shared run typecheck`
- `mise exec -- pnpm --filter @aiops/shared run build`
- `mise exec -- pnpm --filter @aiops/server run typecheck`
- `mise exec -- pnpm --filter @aiops/shared run test -- xlsxImport.test.ts githubClient.test.ts`
- `mise exec -- pnpm --filter @aiops/server run test -- importLedgerRepo.test.ts xlsxImportRoutes.test.ts`
- `mise exec -- pnpm --filter @aiops/shared run lint`
- `mise exec -- pnpm --filter @aiops/server run lint`
- `mise run traceability`
- `mise exec -- pnpm exec tsx packages/shared/src/xlsxImport/generateTemplate.ts /private/tmp/aiops-import-template.xlsx`
- `mise run -j 1 ci`
- `make require-crit-review` (target unavailable)
- `git commit -m "feat(import): add xlsx GitHub import flow"`
- `git push -u origin agent/T08`
- `gh pr create --repo mryfmo/ai-ops-platform --base main --head agent/T08 ... --label ai-generated`

## Sandbox Notes

- `.orchestration` was temporarily moved to `/private/tmp/aiops-t08-orchestration` during full CI so untracked orchestration artifacts would not affect `prettier --check .`.
- `packages/traceability/output/traceability_matrix.md` was restored after traceability/CI because it is generated output.
- No destructive commands were used.
- No real GitHub import operation was executed; tests used mocks.
