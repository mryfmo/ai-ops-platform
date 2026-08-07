-- ADR-0006 / DevOps:REQ-028: dispatch時に選んだGitHubリポジトリをタスクへ固定する。
--
-- reaperは実行状態を観測してから回収可否を決めるが、観測先リポジトリを reap 時点の
-- project_channels から引き直していた。running の間にチャネル構成が変わると
-- （元チャネルが閉じて別のactiveチャネルが選ばれる等）dispatch 先とは別のリポジトリを
-- 観測してしまい、そこには run が無いので「run 皆無」と誤判定して failed で終端させる。
-- 元リポジトリで走っていたジョブの callback はその後 status='running' 条件に弾かれる。
--
-- 観測は dispatch 時に選ばれた不変のスコープに対して行う必要があるため、選択結果を保存する。
-- 既存行は NULL のまま残す。reaper は NULL を「観測不能」として扱い、回収しない。

ALTER TABLE coding_tasks ADD COLUMN IF NOT EXISTS github_owner TEXT;
ALTER TABLE coding_tasks ADD COLUMN IF NOT EXISTS github_repo TEXT;

-- rollback: ALTER TABLE coding_tasks DROP COLUMN IF EXISTS github_owner, DROP COLUMN IF EXISTS github_repo;
