# Handoff: P4 checkpoint（2026-08-15）

正本 handoff。前版: 2026-08-13-p2-pause-p3-entry.md（P3 経緯はそちらと
P3 各証跡を参照）。

## 到達点

- **P3**: T01-T11 完了 merge 済み。T12（legacy 退役）は rollback-window close が
  Owner gate のため deferral 記録済み（.orchestration/tasks/P3-T12-deferral.md）
- **P4**: T01(#228) T02(#231) T03(#229) T04(#232) T10(#233) T11(#234) 完了
  merge 済み。すべて codex adversarial review（T02/T04/T10/T11 は orchestrator
  review）+ fresh-DB `mise run ci` 単独判定 + exact-head CI green を経ている
- **Owner 裁定 2026-08-15**（docs/decisions/2026-08-15-p4-preparatory-classification.md、
  PR #230）: P4 成果物は non-enabled preparatory configuration。
  **runtime 有効化・P4 entry 正式クローズ・T04 以降の live 結線は
  license register（agentgateway/OPA 行）クローズが前提**

## 残タスクと gate

| タスク | 状態 | blocker |
| ------ | ---- | ------- |
| P4-T05..T08（MCP onboarding） | 未着手 | register クローズ + 実 endpoint/tenant（Owner） |
| P4-T09（prompt-injection 防御） | 未着手 | T05-T08 後続 |
| P4-T12（MCP production gate） | 未着手 | 上記全部 + Owner 承認 |
| P3-T10 staging soak / P3-T12 退役 | 保留 | AWS env（Owner） |
| P2-T03/T04/T10 | 保留 | test tenant / AWS env（Owner） |

## 運用規範（このフェーズで確立・memory にも記録）

- 実務（実装・conflict 解消・修正 round・approve/merge 執行）は codex へ委任。
  orchestrator は起票・裁定・adversarial review・acceptance・push/PR 代行のみ
- worker task 実行中は共有 worktree の checkout/branch 操作禁止
  （状態確認は `git ls-remote`/`gh` のみ）
- **open PR 間のファイル素は完全分離**。evidence sync は関連 PR 全 merge 後
- bot PR の web UI approve 不能事象（#222/#231/#233 反復）: merge 依頼には
  CLI コマンドを添付し、「できない」報告時は即 OPS-PR<n>（診断→approve→
  match-head merge）を codex へ発注
- blocked-auth: worker は commit まで、push/PR は orchestrator が App token 代行
- 55432 Postgres 停止時: `container system start` →
  `container start aiops-p001-postgres`

## 技術的申し送り

- P4-T10 note: timeout 時の外部作用は unknown — live 結線時に P3 の
  single-attempt + reconcile 規範を onboarding 要件へ含める
- P4-T04/T10 note: duplicate/limit 経路の orphan pending approval（監査可能）
- P4-T02 note: mcpAuthorization rules の operation 名は placeholder —
  onboarding 時に per-server 実 tool 名 mapping へ精緻化
- P4-T11 note: policy-decision-less invocation は project scope から不可視
  （保守的方向。live 後に欠落監視）
