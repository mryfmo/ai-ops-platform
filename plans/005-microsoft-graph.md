# Plan 005: Microsoft Graph Teams/Outlook購読・送信経路を公式仕様へ適合させる

> **Executor instructions**: Microsoft Learnの現行v1.0仕様を一次根拠にする。sandbox tenant以外へ実送信しない。URL/permission/resource lifetimeを推測しない。
>
> **Drift check**: `git diff --stat 21306d8..HEAD -- packages/shared/src/clients/graphClient.ts packages/server/src/auth packages/server/src/http/routes/graphNotifications.ts packages/server/src/scheduler/tasks packages/server/src/tools docs/teams-app`。

## Status

- **Priority**: P0
- **Effort**: L
- **Risk**: HIGH — tenant message/mail権限と通知欠落。
- **Depends on**: Plan 001
- **Category**: bug / security / integration
- **Planned at**: commit `21306d8`, 2026-07-11
- **Core local implementation**: ACCEPTED at working tree based on commit `6a6c1aa`; P005-T08/T09/T11 independent reviews accepted。
- **Remaining acceptance**: BLOCKED — 実sandbox adapterとRSC/RBAC/public callback/delegated actorを用いたtenant evidence pending。

## Plan quality self-audit

- [x] 誤URL、dedupe、lifecycle、renew timingを測定。
- [x] official endpoint/RSC/lifecycleを参照。
- [x] sandbox-onlyとleast privilegeを安全回帰へ固定。
- [ ] 実tenant smoke raw IDsをredactして保存。

## Why this matters

card送信URLが公式形と異なり、message更新/削除はdedupeで捨てられ、lifecycle URLも購読作成時に登録されない。Teams/Outlookが製品の通知・承認・報告面なので、mockの成功ではなく実tenantで閉じる必要がある。

## Current state

- [x] team+channelを必須にしたroot/reply URLとsubscription policyを実装済み。
- [x] created/updated/deletedを区別し、exact redeliveryだけをskipするdedupeを実装済み。
- [x] lifecycle URL、resource別renew、restart/polling/delta backfillを実装済み。
- [x] MSAL client credentials、single-flight cache、fixed error、429 retryを実装済み。
- [x] sandbox allowlist、exact opt-in、DB request correlation、atomic no-overwrite evidence、finally cleanupを持つsmoke APIを実装済み。
- [ ] `packages/server/src/tools/graphSmoke.ts:318` のCLIは外部tenant adapterが未配線のためE-SMK07で停止する。Plan 009 F03-T02で配線する。
- [ ] RSC install/consent、Exchange App RBAC、public callback、delegated/UI edit/deleteの実tenant証跡は未取得。

## Commands you will need

| Purpose       | Command                                                                                     | Expected                                                                    |
| ------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Shared tests  | `pnpm --filter @aiops/shared test -- graphClient`                                           | all pass                                                                    |
| Server tests  | `pnpm --filter @aiops/server test -- graphNotification subscription channel reportDelivery` | all pass                                                                    |
| Full gate     | `mise run ci`                                                                               | exit 0                                                                      |
| Sandbox smoke | `pnpm --filter @aiops/server run graph:smoke -- --sandbox`                                  | Plan 009 F03-T02完了前はE-SMK07。完了後だけsend/read/mail/subscription pass |

## Scope

**In scope**: Graph client input types/URLs、token scopes、subscription create/renew/lifecycle、dedupe、Teams manifest/install verification、Outlook send、tests/runbooks。

**Out of scope**: production tenant consent実行、Bot Framework導入、Teams UI redesign、mail content business rules。

## Steps

### Step 1: team/channel型と送信URLを修正する

- [x] `sendAdaptiveCard` に `{teamId, channelId}` を必須化し公式URLへ変更。
- [x] recipient/config/callerを全更新しchannel単独fallbackを削除。
- [x] RSC installation/consentを送信前checkまたはrunbook gateにする。

**Verify**: Positive—mockがexact official URL/body/201を検証。Adversarial—team/channel欠落、別team、403で送信成功扱いしない。

### Step 2: dedupeをchange単位へ修正する

- [x] subscription+team+channel+message+changeType+resource version等でevent identityを作る。
- [x] exact redeliveryだけskipし、created→updated→deletedは順に処理。
- [x] channel_messages upsert/deleteを統合testする。

**Verify**: Positive—3 changeを全部反映。Adversarial—同一notification再送だけevents rowが増えない。

### Step 3: subscription lifecycleを閉じる

- [x] create時にHTTPS lifecycleNotificationUrlを渡しvalidation handshakeを検証。
- [x] resource別max lifetimeとrenew marginを設定し、期限前に必ずrenew。
- [x] restart時にexpired/near-expiryを即処理し、missedはdelta backfill。

**Verify**: Positive—clock fixtureで全offsetがexpiry前renew。Adversarial—clock jump、process停止45分、PATCH 404/429でpolling/backfillへ遷移。

### Step 4: token/permission/mail境界を検証する

- [x] required scopesをread/send/mail/subscription別に文書化。
- [x] Mail.Sendを指定mailboxへ制限するExchange App RBACをrunbook gate化。
- [x] token cache/expiry/429 retryをtestする。

**Verify**: Positive—sandbox mailbox/channelだけ成功。Adversarial—非allowlist mailbox/teamは403、auditに本文/secretなし。

### Step 5: 実tenant smokeを自動化する

- [ ] create subscription→post→receive→fetch→reply→edit/delete→delta→mailをsandboxで実行。
- [x] resource cleanupをfinallyで行う。
- [x] redacted evidence schemaとno-overwrite writerを実装しPlan 008へ引き渡せる形にする。

**Verify**: Positive—全correlation IDとDB rowが一致。Adversarial—clientState不一致notificationは202でもDB未投入、security auditだけ残る。

## Test plan

- exact URL/body/status contract tests。
- lifecycle clock/restart/429/404 tests。
- dedupe create/update/delete/redelivery tests。
- RSC/mailbox allowlist negative tests。
- sandbox tenant smoke。

## Done criteria

- [x] 誤URLとchannel-only inputが消える。
- [x] edit/deleteを落とさずexact redeliveryだけskipするローカルcontract testがgreen。
- [ ] lifecycle URL、renew、polling/backfillが実tenantで成功。
- [ ] Mail.Send/RSCがleast privilegeで確認済み。
- [x] ローカル `mise run ci` green、独立review accepted。
- [ ] smoke CLIの実adapterが配線され、tenant smokeがexit 0。
- [ ] tenant evidence受入後にREADME 005をDONEへ更新。

## STOP conditions

- sandbox tenant/RSC consent権限がない。
- Teams appが対象teamへinstallされていない。
- required APIがtenant cloudで非対応。
- protected API申請が必要で未承認。
- mailbox access policyを設定できない。
- official endpoint/permission資料が競合する。

## Maintenance notes

- Graph resource lifetime変更は公式doc確認日とtest clockを更新。
- URL組立はGraphClient一箇所に限定。
- RSC app install解除を定期reconciliation対象にする。

## 安全回帰

- [ ] clientStateを定数時間相当で検証。
- [ ] tenant-wide権限を不要に広げない。
- [ ] mailbox/team allowlistを強制。
- [ ] message本文保存前sanitize。
- [ ] update/deleteを監査可能に保持。
- [ ] sandbox以外へtest送信しない。
