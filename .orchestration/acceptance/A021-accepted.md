# A021 acceptance record

- task_id: A021
- verdict: accepted(**merge は owner gate — PR #115 は draft のまま操作者承認待ち**)
- reviewer: orchestrator-fable5 (claude-code)
- date: 2026-07-19

## 検証(独立)

- 3 ファイルのみ(ADR-0019 / plans/014 / README 行)。README の意味的差分は 014 行追加のみ。
- ADR は改訂骨子に忠実: 統治重量の三層表 + **フィールド単位の勝者規則**(記録級 = git-wins、
  state/position/assignee/cycle/日常コメント = Plane-wins、platform は派生のみ)で同一フィールドの
  dual-truth を排除。両極端(全 git 往復 / Plane 全正本)+ GHP v2 継続 + 自前 Kanban + Commercial の
  5 代替案を再検討条件付きで棄却記録。
- セキュリティ規律: #5757 の negative probe を導入 STOP + release 毎 probe、専用 integration user の
  最小 membership、discussion 本文・identity field を platform へ複製しない PII 規律、
  webhook の署名/raw-body/allowlist 検証、GET のみ idempotent retry。
- AGPL 境界: vendor/リンク禁止、改変時は公開 fork 先行 + owner/法務確認。
- 統治: ADR 採用だけでは board を切り替えない — DEC-SPEC-008 置換は Plan 014 Phase C の
  decision PR(脅威/データ影響レビュー + Plan 010 T11-T14 同一コミット更新 + owner 承認)に分離。
  それまで Plane は shadow observation 限定。
- 独立 plan レビューが検出した P1 4 件(exact-SHA 投影 / 単一トランザクション snapshot /
  署名マッピング DI / PII 統治)は最終版で解消済み。
- format / traceability / ci / hosted checks green。

## owner への提出事項

- PR #115(draft)の承認 = ADR-0019 の「提案」内容の承認。採用化(ステータス「採用」)と merge、
  および Phase A 着手はあなたの指示で実施。
