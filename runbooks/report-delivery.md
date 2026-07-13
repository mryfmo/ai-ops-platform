<!-- 根拠: ADR-0014 / AUD-OPM-009 -->

# Report Delivery Runbook

This runbook covers ADR-0014 report ingest, Outlook delivery, Teams cards, dashboard deep links, and Graph subscription creation.

## Prerequisites

- PostgreSQL schema includes `recipients`, `standard_reports`, and `report_delivery_log`.
- Microsoft Graph app has the required Teams message permissions for the configured tenant. Mail sending is granted separately through the mailbox-scoped Exchange Online Application RBAC procedure below.
- Server env includes `PUBLIC_BASE_URL`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, `GRAPH_TENANT_ID`, `GRAPH_CLIENT_STATE`, `GRAPH_ALLOWED_TEAM_IDS`, `GRAPH_ALLOWED_FROM_MAILBOXES`, and `REPORT_INGEST_SECRET`.
- Delivery is intentionally disabled until `REPORT_DELIVERY_ENABLED=true` and `FROM_MAILBOX` are set.
- At least one active `recipients` row exists with `email`; Teams cards require both `teams_team_id` and `teams_channel_id`.
- The Teams app manifest requests team-scoped `ChannelMessage.Send.Group`; install the app and grant RSC consent in each target team before enabling cards. This runbook does not perform installation or consent.

## Restrict Mail.Send to FROM_MAILBOX (T-P1-12, HUMAN)

> **HUMAN tenant change:** An Exchange Online administrator must review and run this section in the target tenant. Agents must not run these commands. Keep all tenant-specific values as `TBD(HUMAN)` until the approved change window, and never paste client secrets, access tokens, or authorization headers into this runbook or its evidence.

This procedure uses [RBAC for Applications in Exchange Online](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac), not the legacy [Application Access Policy](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-access-policies). Exchange Application RBAC assignments and Microsoft Entra application permissions are additive. An unscoped Entra `Mail.Send` grant would therefore bypass the mailbox scope and must be removed after the scoped assignment is ready.

### Preconditions and approved placeholders

- The operator is authorized to manage Exchange Application RBAC (normally Exchange Online `Organization Management` and the required Microsoft Entra administrator role).
- `FROM_MAILBOX` is a dedicated service mailbox and its exact primary SMTP address is approved.
- Report delivery is disabled for the change window (`REPORT_DELIVERY_ENABLED=false`).
- A dedicated, non-production test sink is approved. It must not be a distribution list and must not forward messages.
- Record these values in the approved change ticket, not in this repository:

  ```powershell
  $AdminUpn = "<TBD(HUMAN): Exchange Online administrator UPN>"
  $AppId = "<TBD(HUMAN): GRAPH_CLIENT_ID / Entra application client ID>"
  $ServicePrincipalObjectId = "<TBD(HUMAN): Entra enterprise application object ID>"
  $FromMailbox = "<TBD(HUMAN): exact FROM_MAILBOX primary SMTP address>"
  $OutOfScopeMailbox = "<TBD(HUMAN): approved test mailbox other than FROM_MAILBOX>"
  $NegativeTestSink = "<TBD(HUMAN): approved dedicated sink mailbox>"
  $ChangeMarker = "<TBD(HUMAN): non-secret change-ticket marker>"
  $ScopeName = "AIOps-Report-Delivery-Mailbox"
  $AssignmentName = "AIOps-Report-Delivery-MailSend"
  $ServicePrincipalDisplayName = "AIOps Report Delivery"
  ```

The service principal object ID is the object ID from the tenant's **Enterprise applications** service principal, not the object ID shown for the app registration. Confirm the mailbox and IDs against the approved change ticket before continuing.

### Apply the scoped assignment

Run each mutating command individually and inspect its result. Do not blindly rerun `New-*` commands if an object already exists.

```powershell
Connect-ExchangeOnline -UserPrincipalName $AdminUpn

$MailboxMatches = @(
  Get-EXOMailbox `
    -PrimarySmtpAddress $FromMailbox `
    -Properties PrimarySmtpAddress,RecipientTypeDetails,ExternalDirectoryObjectId
)

if ($MailboxMatches.Count -ne 1) {
  throw "STOP: FROM_MAILBOX must resolve to exactly one mailbox"
}

$Mailbox = $MailboxMatches[0]
$MailboxExternalDirectoryObjectId = [string]$Mailbox.ExternalDirectoryObjectId
if ([string]::IsNullOrWhiteSpace($MailboxExternalDirectoryObjectId)) {
  throw "STOP: approved mailbox has no ExternalDirectoryObjectId"
}

$Mailbox |
  Format-List DisplayName,PrimarySmtpAddress,RecipientTypeDetails,ExternalDirectoryObjectId

Get-ServicePrincipal -Identity $ServicePrincipalObjectId |
  Format-List DisplayName,AppId,ObjectId
```

Record the resolved `PrimarySmtpAddress` and immutable `ExternalDirectoryObjectId` in the approved evidence, and have a second HUMAN compare both with the change ticket. Stop on zero, multiple, empty, or mismatched results.

If the Exchange service-principal pointer does not exist, create it once:

```powershell
New-ServicePrincipal `
  -AppId $AppId `
  -ObjectId $ServicePrincipalObjectId `
  -DisplayName $ServicePrincipalDisplayName
```

Create a management scope with [`New-ManagementScope`](https://learn.microsoft.com/en-us/powershell/module/exchangepowershell/new-managementscope?view=exchange-ps) using the immutable mailbox object ID, then assign the least-privilege `Application Mail.Send` role with [`New-ManagementRoleAssignment`](https://learn.microsoft.com/en-us/powershell/module/exchangepowershell/new-managementroleassignment?view=exchange-ps):

```powershell
New-ManagementScope `
  -Name $ScopeName `
  -RecipientRestrictionFilter "ExternalDirectoryObjectId -eq '$MailboxExternalDirectoryObjectId'"

New-ManagementRoleAssignment `
  -Name $AssignmentName `
  -App $ServicePrincipalObjectId `
  -Role "Application Mail.Send" `
  -CustomResourceScope $ScopeName
```

Preview the effective scope immediately. It must contain exactly the approved mailbox and the same immutable ID; otherwise stop, remove the assignment and scope, and investigate.

```powershell
$Scope = Get-ManagementScope -Identity $ScopeName
$ScopeRecipients = @(
  Get-EXORecipient `
    -Filter $Scope.RecipientFilter `
    -Properties PrimarySmtpAddress,RecipientTypeDetails,ExternalDirectoryObjectId
)

if ($ScopeRecipients.Count -ne 1) {
  throw "STOP: management scope must contain exactly one recipient"
}
if ([string]$ScopeRecipients[0].ExternalDirectoryObjectId -ne $MailboxExternalDirectoryObjectId) {
  throw "STOP: management scope resolved to an unexpected recipient"
}

$Scope |
  Format-List Name,Identity,Guid,ScopeRestrictionType,RecipientFilter
$ScopeRecipients |
  Format-List PrimarySmtpAddress,RecipientTypeDetails,ExternalDirectoryObjectId
```

### Remove only the unscoped Entra Mail.Send permission

Microsoft's [permission update guidance](https://learn.microsoft.com/en-us/entra/identity-platform/howto-update-permissions) requires both stopping the app registration from requesting an unused permission and separately revoking the permission already granted to the enterprise application. Keep `REPORT_DELIVERY_ENABLED=false` throughout this procedure.

Use Microsoft Graph PowerShell with an approved HUMAN administrator. The constant below is the global application ID for Microsoft Graph, not a tenant value.

```powershell
Connect-MgGraph -Scopes "Application.ReadWrite.All","AppRoleAssignment.ReadWrite.All"

$GraphResourceAppId = "00000003-0000-0000-c000-000000000000"

$ClientApplications = @(Get-MgApplication -Filter "appId eq '$AppId'" -Property Id,AppId,RequiredResourceAccess)
$ClientServicePrincipals = @(Get-MgServicePrincipal -Filter "appId eq '$AppId'" -Property Id,AppId)
$GraphServicePrincipals = @(
  Get-MgServicePrincipal -Filter "appId eq '$GraphResourceAppId'" -Property Id,AppId,AppRoles
)

if ($ClientApplications.Count -ne 1) { throw "STOP: client app registration lookup was not unique" }
if ($ClientServicePrincipals.Count -ne 1) { throw "STOP: client enterprise application lookup was not unique" }
if ($GraphServicePrincipals.Count -ne 1) { throw "STOP: Microsoft Graph service principal lookup was not unique" }

$ClientApplication = $ClientApplications[0]
$ClientServicePrincipal = $ClientServicePrincipals[0]
$GraphServicePrincipal = $GraphServicePrincipals[0]

if ([string]$ClientServicePrincipal.Id -ne $ServicePrincipalObjectId) {
  throw "STOP: enterprise application object ID does not match the approved value"
}

$MailSendRoles = @(
  $GraphServicePrincipal.AppRoles | Where-Object {
    $_.Value -eq "Mail.Send" -and
    $_.IsEnabled -eq $true -and
    @($_.AllowedMemberTypes).Count -eq 1 -and
    $_.AllowedMemberTypes -contains "Application"
  }
)
if ($MailSendRoles.Count -ne 1) { throw "STOP: Microsoft Graph application Mail.Send role lookup was not unique" }
$MailSendRole = $MailSendRoles[0]

$RequestedMailSend = @(
  $ClientApplication.RequiredResourceAccess | Where-Object {
    $_.ResourceAppId -eq $GraphResourceAppId
  } | ForEach-Object {
    $_.ResourceAccess | Where-Object {
      $_.Type -eq "Role" -and $_.Id -eq $MailSendRole.Id
    }
  }
)
if ($RequestedMailSend.Count -ne 1) { throw "STOP: requested application Mail.Send entry was not unique" }

$BeforeGrants = @(Get-MgServicePrincipalAppRoleAssignment -ServicePrincipalId $ClientServicePrincipal.Id -All)
$MailSendGrants = @(
  $BeforeGrants | Where-Object {
    $_.PrincipalId -eq $ClientServicePrincipal.Id -and
    $_.ResourceId -eq $GraphServicePrincipal.Id -and
    $_.AppRoleId -eq $MailSendRole.Id
  }
)
if ($MailSendGrants.Count -ne 1) { throw "STOP: granted application Mail.Send appRoleAssignment was not unique" }
```

Before mutation, save redacted evidence of all `requiredResourceAccess` entries and all app-role assignments (IDs and types only, no tokens). Normalize all non-target permissions so they can be compared after the change:

```powershell
$BeforeOtherRequested = @(
  @(
    $ClientApplication.RequiredResourceAccess | ForEach-Object {
      $ResourceAppId = $_.ResourceAppId
      $_.ResourceAccess | Where-Object {
        -not ($ResourceAppId -eq $GraphResourceAppId -and $_.Type -eq "Role" -and $_.Id -eq $MailSendRole.Id)
      } | ForEach-Object { "$ResourceAppId|$($_.Type)|$($_.Id)" }
    }
  ) | Sort-Object
)

$BeforeOtherGrants = @(
  @(
    $BeforeGrants | Where-Object { $_.Id -ne $MailSendGrants[0].Id } |
      ForEach-Object { "$($_.PrincipalId)|$($_.ResourceId)|$($_.AppRoleId)|$($_.Id)" }
  ) | Sort-Object
)
```

Revoke the one identified enterprise-application grant using Microsoft's [`Remove-MgServicePrincipalAppRoleAssignment`](https://learn.microsoft.com/en-us/powershell/module/microsoft.graph.applications/remove-mgserviceprincipalapproleassignment?view=graph-powershell-1.0), then update the app registration's **complete** `requiredResourceAccess` collection with only that one request removed. Supplying an incomplete collection would remove unrelated requested permissions.

```powershell
Remove-MgServicePrincipalAppRoleAssignment `
  -ServicePrincipalId $ClientServicePrincipal.Id `
  -AppRoleAssignmentId $MailSendGrants[0].Id `
  -Confirm

$UpdatedRequiredResourceAccess = @(
  $ClientApplication.RequiredResourceAccess | ForEach-Object {
    $ResourceAppId = $_.ResourceAppId
    $KeptAccess = @(
      $_.ResourceAccess | Where-Object {
        -not ($ResourceAppId -eq $GraphResourceAppId -and $_.Type -eq "Role" -and $_.Id -eq $MailSendRole.Id)
      } | ForEach-Object { @{ id = $_.Id; type = $_.Type } }
    )
    if ($KeptAccess.Count -gt 0) {
      @{ resourceAppId = $ResourceAppId; resourceAccess = $KeptAccess }
    }
  }
)

Update-MgApplication `
  -ApplicationId $ClientApplication.Id `
  -BodyParameter @{ requiredResourceAccess = $UpdatedRequiredResourceAccess }
```

Reload both objects. The target request and grant must each be zero, while all normalized non-target permissions must be byte-for-byte equivalent. Any difference is a failed change and requires investigation before continuing.

```powershell
$AfterApplication = Get-MgApplication -ApplicationId $ClientApplication.Id -Property Id,AppId,RequiredResourceAccess
$AfterGrants = @(Get-MgServicePrincipalAppRoleAssignment -ServicePrincipalId $ClientServicePrincipal.Id -All)

$AfterRequestedMailSend = @(
  $AfterApplication.RequiredResourceAccess | Where-Object {
    $_.ResourceAppId -eq $GraphResourceAppId
  } | ForEach-Object {
    $_.ResourceAccess | Where-Object { $_.Type -eq "Role" -and $_.Id -eq $MailSendRole.Id }
  }
)
$AfterGrantedMailSend = @(
  $AfterGrants | Where-Object {
    $_.PrincipalId -eq $ClientServicePrincipal.Id -and
    $_.ResourceId -eq $GraphServicePrincipal.Id -and
    $_.AppRoleId -eq $MailSendRole.Id
  }
)
if ($AfterRequestedMailSend.Count -ne 0) { throw "STOP: app registration still requests Mail.Send" }
if ($AfterGrantedMailSend.Count -ne 0) { throw "STOP: enterprise application still has Mail.Send" }

$AfterOtherRequested = @(
  @(
    $AfterApplication.RequiredResourceAccess | ForEach-Object {
      $ResourceAppId = $_.ResourceAppId
      $_.ResourceAccess | ForEach-Object { "$ResourceAppId|$($_.Type)|$($_.Id)" }
    }
  ) | Sort-Object
)
$AfterOtherGrants = @(
  @($AfterGrants | ForEach-Object { "$($_.PrincipalId)|$($_.ResourceId)|$($_.AppRoleId)|$($_.Id)" }) |
    Sort-Object
)

if (Compare-Object $BeforeOtherRequested $AfterOtherRequested) {
  throw "STOP: unrelated requested permissions changed"
}
if (Compare-Object $BeforeOtherGrants $AfterOtherGrants) {
  throw "STOP: unrelated enterprise application grants changed"
}
```

Save the after-state beside the before-state. Remove `Mail.Send` from app-registration manifests, infrastructure-as-code, tenant automation, and consent instructions so a later deployment cannot request or re-consent it. Treat any reappearance in either requested permissions or app-role assignments as a release blocker.

### Verify fail-closed scope

First inspect the objects and simulate authorization. The positive check must show `Application Mail.Send` with `InScope=True`; the negative check must show the same role with `InScope=False`.

```powershell
Get-ManagementScope -Identity $ScopeName |
  Format-List Name,ScopeRestrictionType,RecipientFilter

Get-ManagementRoleAssignment -Identity $AssignmentName |
  Format-List Name,Role,RoleAssigneeName,RoleAssigneeType,AssignmentMethod

Test-ServicePrincipalAuthorization `
  -Identity $ServicePrincipalObjectId `
  -Resource $FromMailbox |
  Format-Table RoleName,GrantedPermissions,AllowedResourceScope,ScopeType,InScope

Test-ServicePrincipalAuthorization `
  -Identity $ServicePrincipalObjectId `
  -Resource $OutOfScopeMailbox |
  Format-Table RoleName,GrantedPermissions,AllowedResourceScope,ScopeType,InScope
```

`Test-ServicePrincipalAuthorization` evaluates Exchange RBAC only; it does not detect permissions granted separately in Microsoft Entra ID. The requested-permission and app-role-assignment checks above are therefore mandatory. Microsoft documents a permission propagation cache of roughly 30 minutes to 2 hours, while the test cmdlet bypasses that cache.

### One-shot live negative verification

Keep `REPORT_DELIVERY_ENABLED=false`. Wait the documented maximum two-hour cache window, acquire a **new** client-credentials access token, and make exactly one direct Graph `sendMail` request from `$OutOfScopeMailbox` to `$NegativeTestSink`. Disable redirects and retries. Use only this fixed, non-confidential payload:

- Subject: `AIOPS RBAC NEGATIVE TEST - $ChangeMarker`
- Body: `Expected denial. No production data. Change: $ChangeMarker`
- No attachments, links, distribution lists, additional recipients, or production content

The expected result is HTTP `403` with an access-denied classification (for example `ErrorAccessDenied`); record only timestamp, request ID, HTTP status, error code, source classification, sink, and change marker. A `2xx` response is an immediate security-test failure: keep delivery disabled, stop further sends, disable or revoke the application's credentials under the approved rollback, notify security, and preserve evidence. Do not retry the negative request.

Only after the negative request is denied may the operator acquire another new token and perform one approved positive send from `FROM_MAILBOX` to the same sink. Expect HTTP `202 Accepted`. Enable scheduled delivery only after the positive and negative outcomes, both permission inventories, and HUMAN review are complete.

Any `FROM_MAILBOX` change requires a new change window. Keep delivery disabled and freeze the old authorization before rebuilding it:

```powershell
Set-ManagementRoleAssignment -Identity $AssignmentName -Enabled $false
Remove-ManagementRoleAssignment -Identity $AssignmentName -Confirm:$true
Remove-ManagementScope -Identity $ScopeName -Confirm:$true
```

Resolve the newly approved address to exactly one immutable `ExternalDirectoryObjectId`, recreate the scope and assignment, and repeat all scope, authorization, permission-inventory, cache-window, and live tests. Do not assume an address change is automatically fail-closed.

### Rollback

Keep report delivery disabled. Remove the assignment before its scope; remove the Exchange service-principal pointer only if it was created exclusively for this application and has no other assignments.

```powershell
Remove-ManagementRoleAssignment -Identity $AssignmentName -Confirm:$true
Remove-ManagementScope -Identity $ScopeName -Confirm:$true

# Optional only after confirming that no other Exchange assignments use this pointer:
Remove-ServicePrincipal -Identity $ServicePrincipalObjectId -Confirm:$true
```

Rollback intentionally leaves mail delivery unavailable. Regranting organization-wide Entra `Mail.Send` restores broad tenant access and is not a routine rollback; it requires separate HUMAN security approval, a time limit, and explicit risk evidence.

### Evidence record (HUMAN)

Complete this record in the approved ticket or evidence store. Do not record secrets, tokens, message bodies, or unnecessary mailbox PII.

| Field                                              | Value                                                            |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| Change ticket                                      | TBD(HUMAN)                                                       |
| Tenant/environment                                 | TBD(HUMAN)                                                       |
| Applied by / reviewed by                           | TBD(HUMAN) / TBD(HUMAN)                                          |
| Application ID / service-principal object ID       | TBD(HUMAN) / TBD(HUMAN)                                          |
| Approved `FROM_MAILBOX`                            | TBD(HUMAN)                                                       |
| Mailbox `ExternalDirectoryObjectId`                | TBD(HUMAN: exact immutable ID and reviewer)                      |
| Scope name / exact `Identity` / `Guid`             | TBD(HUMAN) / TBD(HUMAN) / TBD(HUMAN)                             |
| Assignment name                                    | TBD(HUMAN)                                                       |
| Scope preview exactly one approved recipient       | TBD(HUMAN: yes/no, immutable ID, timestamp, evidence location)   |
| Entra requested `Mail.Send` confirmed absent       | TBD(HUMAN: yes/no, timestamp, reviewer)                          |
| Entra granted `Mail.Send` appRoleAssignment absent | TBD(HUMAN: yes/no, timestamp, reviewer)                          |
| Other permissions unchanged before/after           | TBD(HUMAN: yes/no, normalized evidence locations)                |
| Positive RBAC test (`InScope=True`)                | TBD(HUMAN: timestamp and redacted output location)               |
| Negative RBAC test (`InScope=False`)               | TBD(HUMAN: timestamp and redacted output location)               |
| Live negative request                              | TBD(HUMAN: one attempt, fresh token, 403/error code, request ID) |
| Live positive request                              | TBD(HUMAN: one attempt, fresh token, 202, request ID)            |
| Delivery enabled / confirmation date               | TBD(HUMAN: yes/no, ISO 8601 timestamp)                           |
| Rollback result, if used                           | TBD(HUMAN)                                                       |

## Enable Delivery

1. Set server env:

   ```sh
   REPORT_DELIVERY_ENABLED=true
   FROM_MAILBOX=<TBD(HUMAN): approved service mailbox primary SMTP address>
   GRAPH_ALLOWED_FROM_MAILBOXES=<same approved service mailbox primary SMTP address>
   GRAPH_ALLOWED_TEAM_IDS=<comma-separated exact team ids>
   REPORT_INGEST_SECRET=<32+ char random value>
   DEFAULT_TEAMS_TEAM_ID=<optional team id; pair with channel id>
   DEFAULT_TEAMS_CHANNEL_ID=<optional channel id>
   HEARTBEAT_URL=<optional external dead man's switch URL>
   ```

2. Set GitHub repository variable `REPORT_INGEST_URL` to the public server URL, without a trailing path.
3. Set GitHub repository secret `REPORT_INGEST_SECRET` to the same value used by the server.
4. Run `report-generation.yml`. If the URL or secret is missing, the workflow uploads `report.json` and logs an explicit skip instead of pretending delivery happened.

The allowlists are mandatory, reject empty values and wildcards, and are enforced again by `GraphClient` before token acquisition. Every `recipients.teams_team_id` used for delivery must therefore already be present in `GRAPH_ALLOWED_TEAM_IDS`; database rows cannot add destinations.

## Create Graph Subscription

Build the server package, then run:

```sh
node packages/server/dist/tools/createGraphSubscription.js \
  --teamId "<team-id>" \
  --channelId "<channel-id>" \
  --notificationUrl "https://aiops.example.com/webhooks/graph"
```

The CLI supports only the canonical Teams channel-message resource, computes an expiry with a five-minute safety
buffer below the 4,320-minute maximum, sends `created,updated,deleted`, and uses the same HTTPS callback for
`notificationUrl` and `lifecycleNotificationUrl`. It passes explicit `GRAPH_CLIENT_STATE` and stores Graph's actual
returned expiration with the team and channel IDs.

Authority checked 2026-07-11: [subscription resource limits](https://learn.microsoft.com/en-us/graph/api/resources/subscription?view=graph-rest-1.0)
and [Teams chatMessage change notifications](https://learn.microsoft.com/en-us/graph/teams-changenotifications-chatmessage).

This local workflow does not prove tenant readiness. The app should receive only the least-privilege RSC/read consent
needed for the installed target team/channel. Real smoke remains blocked until a public sandbox HTTPS callback,
tenant credentials, consent, target installation, mailbox policy, and redacted evidence are supplied by an operator.

## Checks

- `/reports/ingest` returns `201` for a new valid report and `200` for a duplicate.
- Invalid HMAC returns `401`; invalid report schema returns `422`.
- Missing server ingest secret returns `503` and writes `report_ingest_disabled`.
- Missing delivery enablement or `FROM_MAILBOX` writes `report_delivery_disabled`.
- Sent reports create `report_delivery_log` rows and duplicate delivery is skipped per recipient.
- When `HEARTBEAT_URL` is configured, a scheduled delivery cycle with zero failed deliveries sends exactly one `GET`
  with a 10-second timeout. No request is sent when the setting is absent, the task is disabled, the day is not a
  scheduled delivery day, a delivery remains failed/pending, or the cycle exits with an exception. The monitor
  product, expected schedule, grace period, escalation destination, URL ownership, and any timeout override are
  `TBD(HUMAN)` before go-live.

## Permanent-failure resend

The current schema records only `pending` and `sent`; it has no retry counter, `failed` state, DLQ, or automatic
transient/permanent classification. Treat a delivery as a permanent-failure candidate only after an operator has
correlated a `report_delivery_log.status = 'pending'` row with repeated `deliver_failed` audit records and confirmed
that the underlying recipient, Graph permission, mailbox, or Teams channel problem will not recover without action.
The retry limit and who may declare a failure permanent are `TBD(HUMAN)`.

1. Identify pending deliveries without changing the append-only audit log:

   ```sql
   SELECT report_id, recipient_id, delivered_at
   FROM report_delivery_log
   WHERE status = 'pending'
   ORDER BY delivered_at;
   ```

2. Correlate the report and recipient with `audit_log` actions `deliver_failed` or `deliver_card_failed`. Preserve the
   `trace_id`, timestamps, and sanitized error text as incident evidence. Do not infer attempt count from the single
   `report_delivery_log` row because each attempt overwrites its `delivered_at`.
3. Correct the external cause. Confirm that the recipient is active, the email/channel target is current, the sending
   mailbox and Graph permissions are valid, and the server is not in failsafe. The owner for each external system and
   the required approval are `TBD(HUMAN)`.
4. Re-submit the exact validated `report.json` to `POST /reports/ingest` using the existing
   `x-aiops-signature-256` HMAC procedure in `.github/workflows/report-generation.yml`. A duplicate report is accepted;
   `pending` entries are retried with `(再送)` in the mail subject, while `sent` entries remain idempotently skipped.
   Do not edit or delete `report_delivery_log` to force a resend.
5. Verify the target row became `sent`, a `deliver` audit record was appended, the recipient received the report, and
   `aiops_report_delivery_total{result="sent"}` increased. If it remains `pending`, stop manual resubmission to avoid
   repeated recipient contact, attach the trace evidence to the incident, and escalate through the `TBD(HUMAN)` path.
