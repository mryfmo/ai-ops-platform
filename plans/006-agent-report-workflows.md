# Plan 006: Claude Code/Droid codingと標準report workflowを安全に実行可能にする

> **Executor instructions**: untrusted instructionを扱うrunnerとpush/PR権限を持つrunnerを分離する。公式action/CLIをversion pinし、実行権限を推測しない。production repositoryへdispatchしない。
>
> **Drift check**: `git diff --stat 21306d8..HEAD -- .github/actions .github/workflows packages/shared/src/reporting packages/server/src/http/routes/codingTasks.ts packages/server/src/db/codingTasksRepo.ts .claude .factory`。

## Status

- **Priority**: P0
- **Effort**: L
- **Risk**: HIGH — agent prompt injection、token漏洩、誤PR、虚偽report。
- **Depends on**: Plans 001, 002
- **Category**: security / correctness / CI
- **Planned at**: commit `21306d8`, 2026-07-11

## Plan quality self-audit

- [x] CLI未導入、API key未配線、Droid read-only、zero metricsを測定。
- [x] agent jobとprivileged publish job分離を明示。
- [x] fake metrics、secret access、permission escalationの敵対検証を配置。
- [ ] 完了時にsandbox workflow run URLとartifact digestを保存。

## Why this matters

coding/report workflowはClaude/Droidを導入せず呼び出し、report jobはAPI keyも渡さず、Droid codingはread-onlyである。さらにreport metricsは未設定をゼロへ変換する。単にCLIをinstallするだけでなく、agentへpush credentialを見せないtrust boundaryと実データ契約を構築する。

## Current state

- `.github/actions/run-coding-agent/action.yml:20-50` — CLI installなし、Droid autonomyなし。
- `.github/workflows/coding-task.yml:79-114` — checkout tokenを保持したworktreeでagentを実行。
- `.github/workflows/coding-task.yml:126-170` — 同jobがcommit/push/PR作成。
- `packages/server/src/http/routes/codingTasks.ts:98-181` — capability URLだけでdispatch、期限/SSOなし。
- `.github/workflows/report-generation.yml:60-90` — CLI/API key setupなし。
- `packages/shared/src/reporting/calculateReportMetrics.ts:7-16` — env欠落を0扱い。
- `.factory/droids/report-generator.md:1-11` — schema参照だけ。
- `.claude/skills/generate-report/SKILL.md:1` — report skillは存在。

## Commands you will need

| Purpose          | Command                                                                                                                                                                                                               | Expected                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Workflow lint    | `npx actionlint .github/workflows/*.yml .github/actions/*/action.yml`                                                                                                                                                 | exit 0                       |
| Report tests     | `pnpm --filter @aiops/shared test -- reporting`                                                                                                                                                                       | all pass                     |
| Coding tests     | `pnpm --filter @aiops/server test -- codingTask`                                                                                                                                                                      | all pass                     |
| Full gate        | `mise run ci`                                                                                                                                                                                                         | exit 0                       |
| Sandbox dispatch | `gh workflow run coding-task.yml --repo "$AIOPS_SANDBOX_REPO" -f task_id=T006-SMOKE -f project_id="$AIOPS_SANDBOX_PROJECT_ID" -f instruction='Create only tmp/agent-smoke.txt' -f base_ref=main -f agent=claude-code` | completed run, draft PR only |

## Scope

**In scope**: coding confirmation/auth state、agent execution action/workflows、credential separation、Claude/Droid pin/install、report data extract/generate/ingest、tests/docs/runbooks。

**Out of scope**: automatic merge、production deploy、provider/modelの追加、LLMによる数値算出、arbitrary self-hosted runner。

## Steps

### Step 1: coding confirmationを認証・期限付きにする

- [ ] confirmationへEntra session、authorized profile、one-time nonce、expires_atを要求。
- [ ] HMAC secretとcallback bearer secretを分離。
- [ ] DB CASでqueued→runningをdispatch前後の失敗に耐える形へ変更。

**Verify**: Positive—authorized userが期限内に1回dispatch。Adversarial—転送URL、expired/replayed token、別tenant/profile、CSRFでdispatch 0。

### Step 2: agentとpublish権限を分離する

- [ ] agent jobは `persist-credentials:false`、read-only checkout、provider keyと最小tool権限だけを持つ。
- [ ] agent outputはpatch artifact+manifest+digestとし、push tokenへアクセスさせない。
- [ ] 別publish jobがartifactを検証し、一時GitHub App tokenでbranch/PRを作る。

**Verify**: Positive—valid patchからdraft PR作成。Adversarial—agent promptがenv/git credential/network exfiltrationを要求してもtoken不在、scope外path/symlink/binary/oversize patchはpublish拒否。

### Step 3: Claude CodeとDroidを公式方式でpinする

- [ ] Claude Code Action v1またはchecksum付きCLIをcommit SHA/version pin。
- [ ] Droid action/CLIをversion/checksum pinし、編集に必要な最小 `--auto`/toolsを明示。
- [ ] `--max-turns`、timeout、concurrency、cost上限を設定。

**Verify**: Positive—両agentが同fixtureを1file変更しpatch生成。Adversarial—command not found、permission prompt、no-change、timeout、budget超過を明示status/callbackへ変換。

### Step 4: report metricsを実データextractへ置換する

- [ ] DB/GitHub snapshotからperiod+scope付きmetrics JSONをcode生成。
- [ ] 欠測はnull/NAまたはjob failureとし、暗黙0禁止。
- [ ] LLMにはmetrics/evidence/periodを入力しnarrative slotsだけ生成。

**Verify**: Positive—fixture rowから期待値。Adversarial—DB空、period不正、evidenceなし、LLM未根拠数値で配信可能reportを生成しない。

### Step 5: report workflowをinstall/auth/ingestまで閉じる

- [ ] Claude/Droid setupとAPI keyを各stepへ明示。
- [ ] schema envelopeを実CLI outputへ合わせcontract testする。
- [ ] ingest config欠落をsilent successにせずproduction scheduleでfailureにする。
- [ ] artifact digest/run IDをreport auditへ保存。

**Verify**: Positive—両agentでvalid report→HMAC ingest→DB record。Adversarial—key欠落、invalid slots、ingest 401/422/5xx、duplicate artifactで正しい非0/idempotent結果。

## Test plan

- confirmation auth/expiry/replay/CSRF/state race tests。
- malicious patch manifest/path/symlink/size tests。
- actionlintとfixture workflow smoke。
- report extract missing/null/period/evidence tests。
- Claude/Droid output envelope contract tests。

## Done criteria

- [ ] agent processからpush/PR tokenへアクセスできない。
- [ ] authorized one-time confirmationだけdispatchする。
- [ ] Claude/Droid双方がsandboxでpatch/reportを生成。
- [ ] report metricsに暗黙0がない。
- [ ] scheduled ingest欠落/失敗がgreenにならない。
- [ ] actionlint、tests、`mise run ci` green。
- [ ] sandbox draft PR/report evidence、README 006更新。

## STOP conditions

- GitHub Appの短命tokenをpublish jobだけへ限定できない。
- agent network egress/secret境界を制御できない。
- Claude/Droid公式versionまたはlicense条件を確定できない。
- report metric source/definition/periodが未確定。
- Entra authorization profileがPlan 002で未提供。
- sandbox repository/keysがない。

## Maintenance notes

- agent version更新はfixture patch/report smoke後のみ。
- publish manifestを唯一のagent→privileged境界にする。
- model変更とmetric変更を同PRに混ぜない。

## 安全回帰

- [ ] agentはmainへpush/mergeしない。
- [ ] push credentialをagentへ渡さない。
- [ ] instruction/patch/reportをsanitize/validate。
- [ ] 数値はcode生成、LLMは文章のみ。
- [ ] human confirmation/reviewを維持。
- [ ] cost/turn/timeout上限を強制。
