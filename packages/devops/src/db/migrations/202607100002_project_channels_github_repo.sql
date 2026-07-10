-- 2026-07-07 ADR-0005 / SPEC-INT-033: project_channelsにGitHubリポジトリ紐付け列を追加。
ALTER TABLE project_channels ADD COLUMN IF NOT EXISTS github_owner TEXT;
ALTER TABLE project_channels ADD COLUMN IF NOT EXISTS github_repo TEXT;
-- rollback: ALTER TABLE project_channels DROP COLUMN IF EXISTS github_owner; ALTER TABLE project_channels DROP COLUMN IF EXISTS github_repo;
