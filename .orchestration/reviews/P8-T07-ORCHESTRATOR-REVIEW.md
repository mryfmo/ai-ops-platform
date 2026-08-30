# P8-T07-ORCHESTRATOR-REVIEW — approve at `effc8ad`

- task_id: P8-T07 / reviewer: claude-code-fable5-xhigh（orchestrator、adversarial）
- reviewed_at: 2026-08-18
- head_sha: effc8ade7f9b93a0b36cbd4338a67d5ee25888f4
- verdict: **approve**

## 独立再検証

- control-plane / server（DB-less 含む）tests 再実行、fresh-DB
  `mise run ci` exit 0（validation 参照）
- scope: control-plane workflows + server db + devops schema/migration +
  証跡のみ。open PR #268 と重複ゼロを機械照合。
  **裁定注記**: WBS allowed_paths は server/db のみ記載だが、AGENTS.md の
  schema 変更手順（schema.sql + migrations + repo 層 + tests 同一 PR）が
  devops 側 DDL を必須とするため、devops/src/db への接触は手順準拠として承認

## 検分（COD-001 / COD-002、acceptance 2 点）

- **one writer**: writer ≠ reviewer を型・状態機械・DB CHECK の三層で強制。
  全 event に actor 制約（start/submit/resume = writer のみ、approve/
  rework/takeover = reviewer のみ）。version CAS（stale 拒否）+
  DB は **full-state CAS**（version だけでなく writer/reviewer/state/range
  全一致を WHERE に含む UPDATE）で concurrent claim を構造遮断
- **role change explicit（acceptance）**: takeover は oldWriter/newWriter/
  reason/新 commit range の全 field 必須（exactKeys で余剰・欠落とも拒否）、
  役割 swap の整合（oldWriter=現 writer、newWriter=現 reviewer）を検証。
  暗黙の role 変化は表現不能
- **commit range pinned（acceptance）**: 全遷移 record に 40-hex base/head
  束縛。submit は assigned base からの新 head 必須、approve/rework は
  **review range と exact 一致**必須 — head が変われば旧 approve は成立不能
  （dismiss_stale_reviews と同型の一貫性を状態側でも強制）。
  resume_rework は reviewed head からの再開に固定
- **DDL 二重強制**: 状態↔review range の対応・writer≠reviewer・SHA/ID 形式・
  resulting_version=expected+1 を CHECK で DB 側にも複製（P3/P4 の
  dual-enforcement 規範）。transitions は追記表 + AuditLogWriter.append
- workflow 結線は注入 activity 契約でネットワークなし test（P3 determinism
  規約準拠）。COD-003（concurrent claim 拒否）の test あり

## 妥当性判断

canon「One Writer protocol」の全文言が型・純関数・DB 制約の三層に写像され、
acceptance 2 点はいずれも「表現不能化」まで到達している。P8 の ci 面は
本タスクで完了。
