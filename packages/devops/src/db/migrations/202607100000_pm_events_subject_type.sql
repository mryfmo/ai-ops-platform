-- 2026-07-10 ADR-0007 / DevOps:SPEC-INT-062 / SPEC-INT-081: pm_events subject_typeの拡張。
ALTER TABLE pm_events DROP CONSTRAINT IF EXISTS pm_events_subject_type_check;
ALTER TABLE pm_events ADD CONSTRAINT pm_events_subject_type_check CHECK (subject_type IN ('issue', 'pull_request', 'milestone', 'project_item', 'project_status', 'deployment')) NOT VALID;
-- rollback: ALTER TABLE pm_events DROP CONSTRAINT IF EXISTS pm_events_subject_type_check; ALTER TABLE pm_events ADD CONSTRAINT pm_events_subject_type_check CHECK (subject_type IN ('issue', 'pull_request', 'milestone', 'project_item')) NOT VALID;
