-- 2026-07-10 A-11: NOT VALID制約を既存行へ適用する検証パス。
-- 注意: VALIDATE CONSTRAINT は長時間実行時に共有ロックを取り得るため、実DBでは低トラフィック時間帯に実行する。
ALTER TABLE events VALIDATE CONSTRAINT events_status_check;
ALTER TABLE pm_events VALIDATE CONSTRAINT pm_events_subject_type_check;
ALTER TABLE import_ledger VALIDATE CONSTRAINT import_ledger_status_check;
ALTER TABLE recipients VALIDATE CONSTRAINT recipients_profile_check;
ALTER TABLE report_delivery_log VALIDATE CONSTRAINT report_delivery_log_status_check;
-- rollback: no-op; constraint validation state is not reverted.
