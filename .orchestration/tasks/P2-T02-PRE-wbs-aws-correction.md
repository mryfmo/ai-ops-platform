# P2-T02-PRE WBS AWS 読み替え実体化の独立レビュー

- task_id: `P2-T02-PRE-REVIEW`
- 根拠: ADR-0029 / IMPORT_NOTES P0-T07a / Owner 指示（2026-08-12: 読み替え注記で回避せず正本側を是正）
- 対象 PR: https://github.com/mryfmo/ai-ops-platform/pull/184（branch `agent/wbs-aws-path-correction`）
- reviewer: codex-gpt56-sol-high（P2-ENTRY-REVIEW と同型の独立レビュー）

## レビュー観点

1. **完全性**: `deploy/azure/**` → `deploy/aws/**` が WBS 全 12 箇所で漏れなく置換され、
   pack 内に binding フィールド（allowed_paths / verification / environment / title）の
   Azure/Bicep 残存がないこと。歴史記述（BASELINE.md:21、GAP-012、audit 群）は不変更が正。
2. **対応表整合**: P10-T01 の title/deliverables/acceptance/verification と REL 系 environment の
   置換が IMPORT_NOTES「P0-T07a: ADR-0029 AWS 読み替え規則」対応表と一致すること。
3. **除外判断の妥当性**: `ops/azure-monitor-alerts/**`（現存資産、KQL 6 rules）を対象外とした判断。
4. **機械検証**: exact head で `shasum -c SHA256SUMS` 全行 OK、
   `validate_pack.py`（uv run --with pyyaml --with jsonschema）が
   「113 WBS tasks, 64 acceptance gates, 101 files」を維持、
   `10_wbs_task_summary.md` が `render_task_summary.py` の再生成結果と一致（diff なし）。
5. **台帳**: IMPORT_NOTES の `P2-T02-PRE` 行が既存様式（P2-ENTRY 行）と整合。

## 制約

- read-only レビュー。PR branch の編集・push・GitHub 上の review submission・merge は禁止
- 依存追加・lockfile 変更禁止（uv の一時環境は可）
- 検証は exact head SHA を明記して実施

## 成果物パス

- review 記録: `.orchestration/reviews/P2-T02-PRE-REVIEW.md`
  （P2-ENTRY-REVIEW.md と同書式: yaml ヘッダに task_id/reviewer/reviewed_at/pull_request/
  base_sha/head_sha/verdict/findings、本文に独立検証結果）
- 完了通知: `AGMSG-RESULT v1 task_id=P2-T02-PRE-REVIEW status=approve|revise head=<sha> result_file=<path> summary=<short>`
