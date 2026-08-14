# P4-T01 Acceptance — Deploy agentgateway in MCP/A2A-only mode

- task_id: P4-T01 / PR: #228 / final head: 6aeaa570d5c2
- writer: claude-code-fable5-xhigh / reviewer: codex-deep-dot（adversarial、3 巡 + 追補 2 回）
- date: 2026-08-15
- status: **technical-complete / owner-gated**

## レビュー経過

| Round | head | 結果 |
| ----- | ---- | ---- |
| 1 | ff91857 | revise: findings 001-005（sentinel 迂回・blocklist 迂回・identity 非 pin・entry gate・matrix diff） |
| 2 | 76b262f | 001-003 resolved。新規 006-008（decoy target・運用値 drift・スコープ汚染）、005 未解消 |
| 3 | 8428e7a | 005-008 resolved。新規 009（report 冒頭陳腐化、low） |
| 追補 | 154fc5f → 6aeaa57 | 009 resolved（残差 3 点含む） |

最終 disposition（reviewer 記録）: **findings 001-003, 005-009 すべて resolved。
open は 004 のみ = binding Owner/Security ruling 待ち。**

## 品質記録

- reviewer の live mutation replay: 11/11 の adversarial 変異が contracts で reject
- container smoke: 2 phase（認証前面 + 認証済み probe、nonce/counter の
  same-process 証明、vendor 厳密形 denial）全 OK
- focused 11/11、contracts 42/42、fresh-DB `mise run ci` exit 0、
  exact-head CI（build-test/gitleaks/CodeRabbit）green
- matrix merge-base diff net-zero（SHA-256 一致を reviewer が独立検証）

## Owner 裁定待ち（finding 004）

次のいずれかで PR #228 は approve/merge 可能になる:

1. license register の agentgateway 行（SBOM/依存 license/NOTICE/承認 role）を
   クローズし、P4 entry を正式クローズする
2. 本成果物を「non-enabled preparatory configuration（runtime 未参照・有効化は
   register クローズ後）」として扱う分類を binding として追認する
   （docs/decisions への記録は裁定後に orchestrator が追記可能）

## 学習

- send.sh の引数形不達・ci 再生成による revert 打ち消し・一括 add による
  スコープ汚染は memory / validation に記録済み（再発防止は運用手順化）

---

## Close（2026-08-15）

- PR #228 merged（main `1d5be6b`）。Owner 裁定 = option 2
  （docs/decisions/2026-08-15-p4-preparatory-classification.md）により
  finding 004 resolved → **P4-T01 close**。runtime 有効化は register クローズ待ち
