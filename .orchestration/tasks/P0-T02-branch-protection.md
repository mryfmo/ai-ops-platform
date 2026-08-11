# P0-T02 main branch protection の適用と負証明

- task_id: `P0-T02`
- writer: claude-code (orchestrator、案A Claude-writer)
- reviewer: codex-deep-dot(#160 merge gate 完了後にレビュー依頼)
- branch: `agent/P0-T02-branch-protection`(worktree: scratchpad/p0t02)
- 根拠: FinalArch:GOV-002 / FinalArch:INV-012 / ADR-0006 / ADR-0027
- 前提裁定:
  - ENV-DEC-011 = GitHub Pro 化。**2026-08-11 Owner 実施完了**(rulesets API が 403→200 を返すことを実測確認)。
  - **Owner 裁定 2026-08-11: AIOPS_PR_TOKEN = GitHub App 方式**(セッション記録)。
    8/10 の「未設定のまま」裁定は Pro 化前の文脈であり、本裁定で置換。

## デッドロック分析(本タスクの設計制約)

- コラボレータは mryfmo 1名。全 PR author = mryfmo。GitHub は self-approve 不可。
- bypass_actors 空の ruleset 有効化後は、mryfmo author の PR は誰も approve できず merge 不能
  (#161 自身を含む)。admin も bypass 不可。
- さらに `require_last_push_approval=true` により、**branch への最終 push 者 ≠ approver** が必須。
  → AI の PR は「App token で push + App token で PR 作成」、Owner(mryfmo)が approve。
- したがって GitHub App 整備は ruleset 有効化の hard prerequisite。

## 実行手順(順序厳守)

1. **#160(P0-T07)merge を先行**(worker merge gate、保護なしの現行フローで完了させる)。
   P0-T07a も可能なら activation 前に merge。
2. Owner: GitHub App 作成・インストール・private key 提供(手順は本セッション記録)。
3. App installation token の発行導線を確立(mint スクリプト、key は repo 外 chmod 600)。
4. #161 を close し、同一 branch から **App token で PR を再作成**(bot author)。
   以後の branch push も App token。
5. `gh api repos/mryfmo/ai-ops-platform/rulesets --input .github/rulesets/main-protection.json`
   → ruleset ID 確認 → CODEOWNERS errors 空確認。
6. 負証明 5 件(runbooks/production-gates.md の表)。**probe 1(main 直接 push 拒否)が
   確認できるまで probe 3(force push)を実行しない**(保護が効いていない状態での
   force push は main を破壊し得るため)。
7. Evidence を runbook 末尾に記入し App token で push → PR ready 化 → Codex レビュー
   (AGMSG-TASK: P0-T02-REVIEW)→ Owner approve → merge(以後 merge は Owner 操作)。

## 受入条件

- ruleset `main-protection` が active、bypass_actors 空のまま。
- 負証明 5 件すべて「拒否」の実ログ(コマンド・HTTP 応答・タイムスタンプ)。
- CODEOWNERS 有効(errors 空)。
- GOV-002: required CI + CODEOWNERS 強制。INV-012: AI token(App)は人間レビュー迂回不可。

## 運用帰結(merge フロー変更、activation 以降)

- worker の merge gate は「threads 解決 + exact-head checks green 確認 + **Owner へ
  approve/merge 依頼**」に変わる。squash-merge 実操作は Owner(または approve 後に
  App token で実行し得るが、AGENTS.md「マージは人間レビュアーのみ」に従い Owner 操作を正とする)。
