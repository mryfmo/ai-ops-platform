# GOV-PR-01 Learning

## Reusable lessons

- [memory:decision] AI PRの責務分離はcommit author名ではなく、PR APIを呼ぶGitHub actorで固定する。App botがbranch/PRを作り、CODEOWNERはapprove/mergeだけを行う。
- [memory:decision] GitHub App tokenのpermissionはmint requestでは狭められない。App permissionsとrepository限定installationを正本にし、JWT/private keyはissuerまたはローカル署名境界から出さない。
- [memory:failure] providerが201を返してもresponseは信頼境界である。JSON、trim済みtoken、future expiryを検証し、失敗時はbody/tokenを診断へ含めない。
- [memory:failure] `.env.example`の`# NAME=`はruntime config inventoryに入る。server Zodで使わないtool-only envは、用途を説明する非assignmentコメントにする。
- [memory:failure] stacked PRの親branch削除は子PRのbaseを失わせる。子を`main`へretargetして確認するまで親branchを残す。

## Promotion

新規Codex learn / skillは作らない。恒久ルールはADR-0032、AGENTS.md、runbook、project CompactionDB decisionへ集約した。

CompactionDB decision command:

```bash
python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project --content 'GOV-PR-01: AI-generated PR authors use GitHub App installation tokens; humans remain CODEOWNER reviewers and merge executors; main bypass_actors stays empty; stacked child PRs are retargeted before parent branch deletion.'
```

cost: n/a
