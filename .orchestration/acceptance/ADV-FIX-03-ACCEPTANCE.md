# ADV-FIX-03 Acceptance (blocked)

- date: 2026-08-18
- status: accepted (blocked disposition — 実装なしの調査成果を受入)
- task: .orchestration/tasks/ADV-FIX-03-guard-wiring.md
- result head: c8704c5 (変更なし)
- cost: n/a

## 判定

blocked は正当。7点の証拠(dispatch inputs 5個のみ / coding_tasks に manifest 列なし / issuer 不在 / path-boundary action は validated manifest 必須 / collector は checkout bytes を素通し)を突合し、workflow 単独パッチが不可能であることに同意。STOP 指示への正しい従い方であり、推測実装を回避した点を評価。

## オーケストレータ設計裁定(ADV-FIX-04 の authority design)

- authority は **exact UTF-8 bytes + raw-byte SHA-256**(canonical JSON 再直列化は採らない。path guard の raw-byte digest と一致させる)。
- coding_tasks へ manifest bytes(TEXT)+ manifest_sha256 列を migration で追加し、UPDATE 禁止トリガ(audit_log と同型の BEFORE トリガ)で不変化。
- issuer は task 起票時に default path profile(GOVERNANCE_SCOPES hard-deny を含む保守的既定)から manifest を生成し `validateAgentTaskManifest()` で検証してから永続化。
- dispatch は manifest material + digest を task_id に束縛して coding/review workflow へ供給。欠落/不一致は credential 発行前に fail-closed。
- 後続: ADV-FIX-04(基盤+結線一体)として再発注。

## 残作業

- ADV-FIX-04 の実施(C-3 完結)。branch protection ruleset 適用は引き続き owner 側。
