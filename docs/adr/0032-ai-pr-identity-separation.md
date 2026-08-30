# ADR-0032: AI生成PRの作成者をGitHub Appへ分離する

- Status: Accepted
- Date: 2026-08-30
- Evidence: `GOV-PR-01`
- Extends: ADR-0006

## Context

AI生成PRを人間オーナーのcredentialで作成すると、GitHub上の作成者・CODEOWNER・マージ実行者が同一人物になり、自己承認を禁じるrulesetと責務分離を構造的に満たせない。CI経路には、P8-T03 credential issuerがrepositoryとpermissionを限定したleased GitHub App installation tokenを発行する設計がある。オーケストレータとローカル作業には、同じbot identityを得る標準経路がなかった。

2026-08-30にはstacked PRの親branchを先に統合・削除したことで、子PR #279/#280がcloseされる事象も発生した。author分離だけでなく、stacked PRのbaseとbranch削除順序も運用契約として固定する必要がある。

## Decision

1. AI生成PRのauthorはGitHub App（bot）とする。CI経路はP8-T03 credential issuerが発行するleased installation tokenを使い、オーケストレータ/ローカル経路は`scripts/mint-aiops-pr-token.mjs`で発行した`AIOPS_PR_TOKEN`を使う。
2. 人間のCODEOWNERSはreviewerとmerge executorに専念する。botはPR作成・branch更新・`ai-generated` label付与を行えるが、自身のPRを人間に代わってapproveまたはmergeしない。
3. main rulesetの`bypass_actors`は恒久的に空とする。緊急時だけ[AI PR identity runbook](../../runbooks/ai-pr-identity.md)のbreak-glass手順で一時付与し、操作後直ちに空へ戻して証跡を記録する。
4. bot reviewerが作成したreview threadへの対応返信と、対応済みthreadの解決はエージェントが行ってよい。これはCODEOWNERSの人間承認を代替しない。
5. stacked PRの親をmergeする前に、開いている子PRのbaseを`main`へretargetして確認する。先にretargetできない場合は、全子PRのretarget確認が終わるまで親branchを削除しない。
6. ADR-0006の自動merge禁止・人間merge原則を維持する。本ADRは、その原則をGitHub identityとcredential経路で実現する具体化である。

## Rationale

GitHub App authorはAIのwrite identityをCODEOWNERから分離し、`require_last_push_approval`と空の`bypass_actors`を自然に成立させる。CIとローカルで同一Appを使えば、経路ごとに別の長期PATを持たず、GitHub側のApp permissionsを単一の最小権限正本にできる。

JWT署名とinstallation token取得をNode標準機能だけの小さなscriptへ閉じることで、private keyをGitHub runnerへ渡すP8-T03のissuer境界やserver runtime設定を変更せず、ローカル作業にも短命bot tokenを提供できる。

## Consequences

### Positive

- AI authorと人間review/mergeの責務分離がGitHub上のactorとして観測可能になる。
- 長期PATではなく短命installation tokenをローカル/オーケストレータ経路でも利用できる。
- bypassを通常運用に持ち込まず、例外操作を時限・復元・証跡付きに限定できる。
- stacked PRのbase喪失による意図しないcloseを運用順序で防げる。

### Trade-offs

- OwnerがGitHub Appの作成/installation、private key保管、permission reviewをGitHub設定画面で行う必要がある。
- ローカルtoken発行にはApp ID、installation ID、chmod 600のPEM pathが必要になる。
- installation tokenの短い有効期限に合わせ、PR操作の直前に再発行する必要がある。

### Rejected alternatives

1. **人間PATでAI PRを作る**: authorとreview/merge責務が分離されず、自己承認問題が残る。
2. **Appをruleset bypass actorへ恒久登録する**: compromised botがreview/merge境界を迂回できる。
3. **default `GITHUB_TOKEN`へ統一する**: ローカル経路を提供せず、PR起点workflowの発火条件も満たせない場合がある。
4. **親branchを先に削除して子PRを作り直す**: review履歴とCI証跡を失うため、base retargetで回復する。
