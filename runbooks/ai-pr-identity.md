<!-- 根拠: ADR-0032 / ADR-0006 -->

# AI PR identity runbook

AI生成PRはGitHub App botが作成し、人間CODEOWNERがreviewとmergeを行う。このrunbookはAppの設定・installation・local mint・break-glass・stacked PRの順序を定める。実Appやcredentialの作成/変更はOwnerがGitHub設定画面と承認済みsecret storeで行う。

## 1. GitHub Appを作成または既存Appを確認する

GitHubの **Settings → Developer settings → GitHub Apps → New GitHub App** を開く。App nameは`aiops-agent`を例とし、組織で一意な名前を選ぶ。Homepage URLはこのrepository、Webhookは無効にし、次のRepository permissionsだけを設定する。

| Permission    | Access |
| ------------- | ------ |
| Contents      | Write  |
| Pull requests | Write  |
| Issues        | Write  |
| Metadata      | Read   |

Organization permissions、Account permissions、event subscriptionは付与しない。installation tokenの権限はmint requestではなくApp設定から継承されるため、ここが最小権限の正本である。

参考用のGitHub App manifestは次のとおり。画面設定と差異があれば上表を優先し、追加権限を許可しない。

```json
{
  "name": "aiops-agent",
  "url": "https://github.com/mryfmo/ai-ops-platform",
  "hook_attributes": { "active": false },
  "redirect_url": "https://github.com/mryfmo/ai-ops-platform",
  "public": false,
  "default_permissions": {
    "contents": "write",
    "pull_requests": "write",
    "issues": "write",
    "metadata": "read"
  },
  "default_events": []
}
```

既存の`aiops-pr-bot`を使う場合は重複Appを作らず、上表との差分をOwnerが確認する。不要なWorkflows権限を除き、label付与に必要なIssues writeを追加した後、設定画面の最終権限を証跡へ記録する。

## 2. 対象repositoryだけへinstallする

App設定の **Install App** から対象ownerを選び、**Only select repositories** で`mryfmo/ai-ops-platform`だけを選ぶ。installation IDはinstallation設定URLの`/installations/<id>`から取得する。別repositoryやorganization全体へのinstallationを許可しない。

## 3. private keyを保管する

App設定の **Private keys → Generate a private key** でPEMを生成する。PEMはrepositoryへ置かず、承認済みsecret storeへ保存する。ローカル利用時だけsecret storeから作業端末のrepository外pathへ取得し、所有者だけが読めるようにする。

```bash
chmod 600 /secure/path/aiops-agent.private-key.pem
```

shell history、`set -x`、CI log、`.env`、`.orchestration/`へPEM、App JWT、installation tokenを記録しない。漏えい時はApp設定で該当private keyを削除し、AI writeを停止して新しいkeyを発行する。

## 4. local / orchestratorでtokenをmintしてPRを作る

```bash
export AIOPS_GH_APP_ID='<app-id>'
export AIOPS_GH_APP_PRIVATE_KEY_PATH='/secure/path/aiops-agent.private-key.pem'
export AIOPS_GH_APP_INSTALLATION_ID='<installation-id>'
AIOPS_PR_TOKEN=$(node scripts/mint-aiops-pr-token.mjs)
GH_TOKEN="$AIOPS_PR_TOKEN" gh pr create --label ai-generated
unset AIOPS_PR_TOKEN
```

scriptのstdoutにはtokenだけが出る。診断はstderrへ出る。tokenはPR操作の直前にmintし、ファイルやGitHub secretへ保存しない。bot reviewerのthreadにはエージェントが返信し、対応済みthreadを解決してよいが、CODEOWNERによる人間のapprovalは別途必要になる。

## 5. CI credential issuerへ接続する

P8-T03 issuerがデプロイされたら、同じGitHub AppのApp ID、installation ID、private keyをissuerのsecret boundaryへ登録する。workflow/runnerへprivate keyを渡さず、issuerがrepository/permission-scopedのleased installation tokenだけを専用push/PR stepへ返す。ローカルの`AIOPS_GH_APP_PRIVATE_KEY_PATH`経路はissuerを迂回するCI fallbackとして使わない。

## 6. main rulesetのbreak-glass

通常時の`bypass_actors`は常に空とする。緊急操作が必要な場合だけ、Ownerが次を順番どおり実施する。

1. incident/change ID、理由、対象操作、実施者、開始時刻を`.orchestration/`の承認済み証跡へ記録する。
2. 現在のruleset JSONとruleset IDを取得し、`bypass_actors: []`であることを保存する。
3. Owner承認後、必要なactorだけをrulesetへ時限追加する。
4. 宣言した1操作だけを実行する。
5. 操作直後に保存済みrulesetへ復元し、`bypass_actors: []`を再取得して確認する。
6. 開始/終了時刻、変更前後JSON、操作結果、復元確認、事後reviewを同じ証跡へ追記する。

復元に失敗した場合は追加操作を止め、AI/App writeを無効化してOwnerへ即時escalateする。Appを恒久bypass actorにしない。

## 7. stacked PRを安全にmergeする

親PRをmergeする前に、親branchをbaseとする全子PRを列挙する。各子PRを`main`へretargetし、GitHub上のbase表示とCI再実行を確認してから親をmergeする。先にretargetできない場合は、親をmergeしても親branchを削除せず、全子PRのretarget確認後に削除する。

```bash
gh pr edit <child-pr-number> --base main
gh pr view <child-pr-number> --json baseRefName,state
```

2026-08-30の#279/#280 close事象のように子PRが意図せずcloseされた場合は、branchを削除・再作成せず、base/stateとreview履歴を確認して同じPRをreopen/retargetできるかOwnerが判断する。

## Verification checklist

- PR authorが`[bot]` identityで、人間CODEOWNERと異なる。
- head branchは`agent/{task-id}`、labelは`ai-generated`。
- App installationは対象repositoryだけで、権限は4項目だけ。
- main rulesetの`bypass_actors`は空で、CODEOWNERS approvalとrequired checksが有効。
- 人間CODEOWNER以外のapprovalやbot thread resolutionをmerge approvalとして数えていない。
- stacked PRの全子baseを確認してから親branchを削除した。
