# P0-T07a 正典追補 chore（ENV-DEC-001 実装帰結）

- task_id: `P0-T07a`
- 根拠: ENV-DEC-001（#160 merge 済み 8b42a88）「実装帰結と正典追補」節 / ADR-0029 / FinalArch:GOV-003
- Writer: codex-gpt56-sol-high / Reviewer: claude-code-fable5-xhigh
- depends_on: P0-T07（merged）。P0-T10 の前提
- branch: `agent/P0-T07a-canonical-amendments`（base = main 8b42a88 以降）。PR + `ai-generated` ラベル

## allowed_paths（この範囲外の編集禁止）

1. `docs/plans/2026-08-final-architecture/06_implementation/02_wbs.yaml` — **P3-T01 行のみ**
2. `docs/security/2026-08-10-secret-identity-migration-plan.md` — **Temporal 行（および同行に直接連動する Azure 前提行）のみ**
3. `docs/plans/2026-08-final-architecture/IMPORT_NOTES.md` — 読み替え規則の追記（是正表の新規行）
4. `docs/plans/2026-08-final-architecture/SHA256SUMS` — 上記 pack ファイル編集に対応する行の再計算（P0-T07-011 の教訓: pack ファイルを編集したら必ず該当行を更新し `shasum -a 256 -c` で自己検証）
5. `docs/plans/2026-08-final-architecture/BASELINE.md` — 既存ハッシュ不一致の解消に必要な場合のみ（下記受入 5）

## 受入条件

1. P3-T01 の deliverable を「Cloud namespace 発行」から「Fargate 単一サービス Terraform + dev compose + mTLS worker 認証 + 起動 runbook」へ差し替え（ENV-DEC-001 の文言と一致させる）
2. P0-T09 マトリクスの Azure 前提行（Key Vault / Entra Workload ID / ACA / Bedrock STS フェデレーション）を ADR-0029 の AWS 等価（Secrets Manager / IAM ロール / Fargate / 同一クラウド IAM）へ改訂。M365（Graph/Teams/Work IQ）向け Entra 資格は M365 専用として維持（ADR-0029）
3. pack 内 Azure 固有記述の読み替え規則（Azure→AWS 対応表: ACA→ECS Fargate、Key Vault→Secrets Manager、Entra Workload ID→IAM ロール、Bicep→Terraform、Azure Monitor→CloudWatch、Front Door→CloudFront+WAF 等）を IMPORT_NOTES.md の是正表へ 1 行 + 対応表として追記
4. 文書間矛盾ゼロ（ENV-DEC-001 / ADR-0029 / WBS P3-T01 / P0-T09 計画 / IMPORT_NOTES の相互参照が閉じること）
5. `shasum -a 256 -c SHA256SUMS` が**全行 OK**（変更ファイルの行更新 + 既存 BASELINE.md 不一致の解消。BASELINE.md 本文を変更する場合は変更理由を PR に明記し、内容変更ではなくハッシュ再計算で解消できるならそちらを選ぶ）

## forbidden_actions

main-direct-push; force-push; merge（レビュー approve 前）; 依存変更; P3-T01 以外の WBS 行変更; ADR/ENV-DEC 本文の変更; 実装コード変更

## 検証

- fresh 使い捨て DB で `mise run ci` exit 0 を単独確認してから push（連結で exit code を潰さない）
- `shasum -a 256 -c docs/plans/2026-08-final-architecture/SHA256SUMS` 全行 OK の出力を validation へ貼付
- 生成物（packages/traceability/output/ 等）の churn を commit に含めない

## 成果物パス

- report: `.orchestration/reports/P0-T07a-report.md`
- validation: `.orchestration/validation/P0-T07a-validation.md`
- sandbox: `.orchestration/sandboxes/P0-T07a-sandbox.md`
- learning: `.orchestration/learning/P0-T07a-learning.md`
- autoskill: `.orchestration/autoskill/runs/P0-T07a-autoskill.md`
