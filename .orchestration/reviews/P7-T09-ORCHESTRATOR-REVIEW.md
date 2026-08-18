# P7-T09-ORCHESTRATOR-REVIEW — approve at `7390ddf`

- task_id: P7-T09 / reviewer: claude-code-fable5-xhigh（orchestrator、adversarial）
- reviewed_at: 2026-08-17
- head_sha: 7390ddf26c728e2a87d7c28ffbb61762e189c6d1
- verdict: **approve**

## 独立再検証

- channel-teams 65/65・web 364/365 再実行、fresh-DB `mise run ci` exit 0
- scope 機械照合: allowed_paths 外ゼロ、open PR #264/#265 と重複ゼロ

## 検分（UX-005 — signed short-lived deep link）

- **token に PII/secret なし**: claims は nonce/workspace/conversation/
  thread/workflow 参照 + **identity は HMAC binding（tenant\0subject の
  domain-separated digest）のみ** — link から tenant/subject を復元できない。
  検証側は **session の署名済み identity から binding を再計算して照合**
  するため、束縛された本人のセッション以外では検証不能（link 所持 = 権限
  ではない、の構造的実装）
- **short-lived**: TTL ≤ 300s を mint/verify 両側で強制（長命 link は
  型 + 実行時双方で表現不能）。a>now / e≤now / e−a>300 すべて拒否
- **single-use**: consumeOnce（注入）を identity 照合**後**・authz **前**に
  消費 — identity 不一致では nonce を burn せず、burn は本人 flow のみ。
  replay authority 不在/例外は fail-closed
- **一様 404 非反射**: 全拒否経路が同一 JSON + 監査 append（token 値を
  監査 detail に残さない test あり）。成功時も監査失敗なら deny
- **per-request authz 再解決**: P7-T08 の handleWorkbenchWorkspace を
  session で再実行し、workflow が workspace.runs に属することまで検証
- card 側: VerifiedWorkbenchHandoffUrl branded type — origin/path/
  query 形状/token 形式を検証した URL のみ card に載る。text スロットは
  固定文字列（LLM 由来文字列の混入経路なし、P7-T06 fallback 制約遵守）
- handoffSecret/identitySecret/consumeOnce 未設定 = handoff_disabled で
  fail-closed（環境 gate 前の構造先行、既存規範どおり）。live Teams E2E は
  tenant 到達後 deferred

## 妥当性判断

「link は capability ではなく本人 session への案内」という設計を HMAC
identity binding + 短命 + 単回 + per-request authz で実装。P7 の ci 面
タスクはこれで全完了。
