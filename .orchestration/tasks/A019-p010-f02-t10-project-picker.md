# A019: P010-F02-T10 scoped project picker を実装する

- task_id: A019
- repo: /Users/mryfmo/Workspace/ai-ops-platform(worktree /private/tmp/ai-ops-platform-A001)
- 発行: orchestrator-fable5 (2026-07-19)
- 担当: codex-gpt56sol-high
- max_turns: 80
- 根拠: plans/010 P010-F02-T10(本文が正本、Allowed files 8 件も plan 指定)+ DEC-SPEC-008。

## 前提手順

1. A018 merge 後の最新 origin/main から新ブランチ `agent/p010-f02-t10-picker` を作成。
2. preflight: validator `--through P010-F01-T11` exit 0。
3. T10 本文と DEC-SPEC-008(docs/spec/productization-decisions.md)を全文読了。
   DEC-SPEC-008 の ENV mapping fixture が repo に無い場合は実装せず blocked 報告。

## 実装要件(plan 本文どおり — 要点)

- scoped `{id,name}` + `portfolioAllowed` 取得、`?project=PJ-*|all` の canonical parser 分類。
- projects API は project query を**拒否**(parameter present → 400 E-AUTH05、domain query 0)。
  `all` option は portfolioAllowed=true 時に UI だけが合成。
- 1 件 auto-select、複数未選択 409、URL back/forward/reload、label/focus/error announcement。
- selection resolve/control のみ(domain endpoint への適用は T13)。
- Complete: client-supplied ID だけで data query を開始する経路 **0**。
  one/many/global/stale/unknown/inactive/malformed/cross-tenant/cross-persona が DEC-SPEC-008 どおり。
- Verify: keyboard/accessible-name tests、query-spy tests、HTTP 200/409/400/403 matrix、
  `rg -n "localStorage|project.*cookie" packages/web/src` の新規 authorization state 0。
- Negative(テストで実証): DOM 改変 option、URL 直打ち、別 persona URL 再利用、同名別 ID、
  case/Unicode/encoded traversal、picker 非経由の直接 API 呼び出し。

## 品質要件

- 根拠 ID ヘッダ、format / `MISE_LOCKED=1 mise run ci` / traceability green。
- crit CLI 自己レビュー(resolved まで)。
- push → PR(base=main、ai-generated)→ checks green → RESULT。merge は受入後。

## forbidden_actions

- plan の Allowed files 8 件 + .orchestration A019 成果物以外の編集、依存追加
- 認可状態の localStorage/cookie 保存、domain endpoint への selection 適用(T13 領分)
- merge-before-acceptance、worklog/docs-audit 編集、LLM API、ブラウザ Crit、ユーザーへのレビュー依頼

## 完了報告

```
AGMSG-RESULT v1 task_id=A019 status=ready_for_review|blocked report=.orchestration/reports/A019-report.md validation=.orchestration/validation/A019-validation.md sandbox=.orchestration/sandboxes/A019-sandbox.md learning=.orchestration/learning/A019-learning.md autoskill=.orchestration/autoskill/runs/A019-autoskill.md
```
