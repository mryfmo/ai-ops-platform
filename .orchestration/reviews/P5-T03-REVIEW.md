# P5-T03-REVIEW — approve at `113c1ae`

- task_id: P5-T03 / reviewer: claude-code-fable5-xhigh（orchestrator、adversarial）
- reviewed_at: 2026-08-16
- head_sha: 113c1aecfb143eda2294baca09bb3d6d947f629a
- verdict: **approve**（note 2 件）

## 経緯

worker の独立レビューが P1（declared projectId/allowedSourceTypes を OPA へ
「ask の enforcement 境界」として渡していた — prompt-prefix は authorization
ではない）を自己検出 → orchestrator 裁定（option a + 誤解を招く authz 入力の
是正必須）→ 是正 commit `77f0969` 適用済み。誠実な self-review を高評価

## 独立再検証

- `@aiops/server` 880/893 pass（新規 route/auth 13 tests 含む）を再実行
- fresh-DB `mise run ci` exit 0（reviewer 環境単独判定 — validation 参照）
- コード読解: `m365Delegated.ts`（243 行）/ `workIqOboTokenProvider.ts`（95 行）

## 検分（WIQ-002 の route/auth 面）

- **検証順序の固定**: bodyLimit（16KB）→ identity envelope（**body 束縛署名** —
  署名後の body 差替え不可）→ 毎リクエスト active recipient → strict parse
  （未知 key 拒否・長さ上限・classification/projectId/sourceTypes 形式検証）→
  tenant 一致 + bearer 必須 → OBO provider（claims を shared validator で再検証、
  subject binding 必須）→ OPA decide（throw/errorCode/require_approval/deny
  すべて 403 fail-closed + decisionId/bundleVersion 付き監査 append）→ client。
  順序 test あり（identity→claims→OPA→client）
- **wrong tenant/audience/subject denied**: tenant 不一致は OBO 前に 403、
  audience/subject は validator + subject-binding が拒否（負 test あり）。
  app-only は validator 段で構造的に不可
- **P1 是正の確認**: policy input は `declaredPurposeScope`（宣言 purpose 文脈）
  として渡し、コード/型コメントで「retrieval を制約しない・isolation は
  M365 trimming + 出力側統制」と明記。semantics 固定 test
  （"purpose context, not an ask authorization boundary"）あり。
  WIQ-002 実 tenant differential は conformance 項目として validation に記録
- **OBO cache**: key = subject/tenant/scopes/audience（contract 準拠）、
  TTL = min(exp−120s, 5min)、期限/subject 不一致 reject。分離 test あり
- workspace 依存追加は amendment どおり 2 entry のみ（lockfile 差分限定）

## Notes

1. `require_approval` は本 endpoint では 403（E-M365-POLICY-APPROVAL）で
   遮断し approval workflow へは繋がない。対話型 query の性質上妥当だが、
   将来 L2 相当の M365 操作を載せる場合は P4-T04 の approval 链接を再利用する
   こと（設計メモ）
2. OBO cache key に userAssertion を含めないのは contract どおり
   （subject/tenant/scope/resource 分離）。assertion の正当性は identity
   envelope + OBO exchange 自体が担保する前提を明記済み
