# GOV-PR-01 Report

- status: ready_for_review
- branch: `agent/GOV-PR-01`
- base: `26b07eaf033c6798d1b394dad2146875523e4f49`
- commit: `b6df5efa75b1d8319d1107141ede71414385a4f7`
- push / PR / GitHub App / credential / ruleset operation: not performed
- cost: n/a

## Result

- ADR-0032で、AI生成PRのauthorをGitHub App botへ分離した。CIはP8-T03 issuerのleased installation token、ローカル/オーケストレータは`AIOPS_PR_TOKEN`を使い、人間CODEOWNERはreviewとmergeを担当する。
- `AGENTS.md`へbot author、恒久的に空の`bypass_actors`、stacked PRのretarget順序を追加した。ADR一覧にも0032を加えた。
- Node 22標準ライブラリだけの`scripts/mint-aiops-pr-token.mjs`を追加した。PEM pathからRS256 App JWTを作り、installation token APIのstatus、JSON、token、expiryを検証して、tokenだけをstdoutへ出す。
- networkless test 9件でJWT claims/signature/API契約、3変数の欠落、HTTP error、malformed/blank/expired response、secret非出力を確認した。
- `runbooks/ai-pr-identity.md`へ最小App権限、manifest例、対象repositoryだけのinstallation、PEM保管、mint/PR操作、P8-T03接続、break-glass、stacked PR手順を記録した。
- `.env.example`にはscript-only変数を説明コメントとして追加した。server Zod configには追加していない。

## Durable facts

- [memory:decision] AI生成PRのauthorはGitHub App installation tokenを使うbotとし、人間CODEOWNERはreview/mergeを担当する。main rulesetの`bypass_actors`は空を保つ。
- [memory:decision] stacked PRの親branchを削除する前に、子PRのbaseを`main`へretargetして確認する。retarget前に親をmergeする場合もbranch削除を遅らせる。
- [memory:failure] `.env.example`の`# NAME=`形式はserver/web runtime config inventoryとして扱われる。script-only変数は変数名と用途をコメントで示し、assignment形式にせずZod inventoryへ混入させない。
- [memory:failure] sandbox内の`mise`初回実行はtrust symlink作成を拒否され、non-TTYの`pnpm exec`はmodules purgeを拒否した。管理された同一commandと既存Prettier binaryで再検証した。

## Validation

- `node --test scripts/mint-aiops-pr-token.test.mjs`: 9/9 green。
- staged secret-pattern scan: clean。
- fresh PostgreSQL 16（port 55491）+ final staged `mise run ci`: exit 0。format、build、typecheck、coverage、P001 integrationを完走。
- Crit: finding-free review-scope approval 1件をresolved。
- `make require-crit-review`: target不在。
- plan-quality-gate: validator、Make target、hook、subagent definition、CI entryがこのbranchに存在しないため、worklog planを必須節・具体command・adversarial checks・STOP条件で手動監査した。

Full evidence: `.orchestration/validation/GOV-PR-01-validation.md`

## CompactionDB

Decision command:

```bash
python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project --content 'GOV-PR-01: AI-generated PR authors use GitHub App installation tokens; humans remain CODEOWNER reviewers and merge executors; main bypass_actors stays empty; stacked child PRs are retargeted before parent branch deletion.'
```

Decision ID: `3897aed4-8d27-40e5-a4f9-6e41046a1e2c`

作業後は`main`へ戻した。task成果物以外の既存untracked fileは変更していない。
