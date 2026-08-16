/**
 * packages/server/src/db/deploymentsRepo.ts
 *
 * 根拠: DevOps:SPEC-INT-020 / DevOps:REQ-010 / DevOps:REQ-012。
 * 本番dispatchのprovenanceと運用上のdispatch_failed状態を永続化する。
 */
import type { ChannelRef, PgQueryable } from "@aiops/shared";

export const DEPLOYMENT_STATES = [
  "pending",
  "staging_deployed",
  "approval_requested",
  "approved",
  "rejected",
  "expired",
  "prod_deploying",
  "monitoring",
  "stable",
  "rolling_back",
  "rolled_back",
  "dispatch_failed",
] as const;
export type DeploymentState = (typeof DEPLOYMENT_STATES)[number];
export type DispatchState = Extract<DeploymentState, "approved" | "prod_deploying" | "dispatch_failed">;

export type DeploymentCasReceipt =
  | {
      readonly kind: "created";
      readonly deployId: string;
      readonly expectedState: DeploymentState;
      readonly observedState: DeploymentState;
    }
  | {
      readonly kind: "stale";
      readonly deployId: string;
      readonly expectedState: DeploymentState;
      readonly observedState: DeploymentState | null;
    };

export interface ApprovedDeploymentTarget {
  deployId: string;
  projectId: string;
  owner: string;
  repo: string;
  commitSha: string;
}

export interface MonitoringDeploymentTarget {
  deployId: string;
  projectId: string;
  owner: string;
  repo: string;
  commitSha: string;
  channels: ChannelRef[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export class DeploymentsRepo {
  constructor(private readonly db: PgQueryable) {}

  async createDispatch(input: {
    projectId: string;
    owner: string;
    repo: string;
    commitSha: string;
    state: DispatchState;
    traceId: string;
  }): Promise<{ deployId: string }> {
    if (!input.projectId.trim() || !input.owner.trim() || !input.repo.trim())
      throw new Error("Invalid deployment target");
    if (!/^[0-9a-f]{40}$/.test(input.commitSha)) throw new Error("Invalid deployment commit_sha");
    if (!UUID.test(input.traceId)) throw new Error("Invalid deployment trace_id");
    const result = await this.db.query(
      `INSERT INTO deployments (project_id, github_owner, github_repo, commit_sha, env, state, trace_id)
       VALUES ($1, $2, $3, $4, 'prod', $5, $6::uuid)
       RETURNING deploy_id`,
      [input.projectId, input.owner, input.repo, input.commitSha, input.state, input.traceId],
    );
    if (!result.rows[0]) throw new Error("Deployment dispatch row was not created");
    return { deployId: String(result.rows[0].deploy_id) };
  }

  async findNextApprovedDispatch(): Promise<ApprovedDeploymentTarget | null> {
    const result = await this.db.query(
      `SELECT deploy_id, project_id, github_owner, github_repo, commit_sha
       FROM deployments
       WHERE state = 'approved' AND env = 'prod'
         AND github_owner IS NOT NULL AND btrim(github_owner) <> ''
         AND github_repo IS NOT NULL AND btrim(github_repo) <> ''
         AND commit_sha ~ '^[0-9a-f]{40}$'
       ORDER BY created_at, deploy_id
       LIMIT 1`,
    );
    const row = result.rows[0];
    return row
      ? {
          deployId: String(row.deploy_id),
          projectId: String(row.project_id),
          owner: String(row.github_owner),
          repo: String(row.github_repo),
          commitSha: String(row.commit_sha),
        }
      : null;
  }

  async markDispatching(deployId: string): Promise<DeploymentCasReceipt> {
    return this.transition(deployId, "approved", "prod_deploying");
  }

  async markDispatchFailed(deployId: string): Promise<boolean> {
    if (!UUID.test(deployId)) throw new Error("Invalid deploy_id");
    const result = await this.db.query(
      `UPDATE deployments
       SET state = 'dispatch_failed', updated_at = now()
       WHERE deploy_id = $1::uuid AND state IN ('approved', 'prod_deploying')
       RETURNING deploy_id`,
      [deployId],
    );
    return result.rows.length === 1;
  }

  async markWorkflowFailed(owner: string, repo: string, commitSha: string): Promise<boolean> {
    return this.transitionByTarget(owner, repo, commitSha, "dispatch_failed");
  }

  async markMonitoring(owner: string, repo: string, commitSha: string): Promise<boolean> {
    return this.transitionByTarget(owner, repo, commitSha, "monitoring");
  }

  async markRollingBack(deployId: string): Promise<DeploymentCasReceipt> {
    return this.transition(deployId, "monitoring", "rolling_back");
  }

  async markRolledBack(deployId: string): Promise<DeploymentCasReceipt> {
    return this.transition(deployId, "rolling_back", "rolled_back");
  }

  private async transition(
    deployId: string,
    from: DeploymentState,
    to: DeploymentState,
  ): Promise<DeploymentCasReceipt> {
    if (!UUID.test(deployId)) throw new Error("Invalid deploy_id");
    const result = await this.db.query(
      `UPDATE deployments
       SET state = $2, updated_at = now()
       WHERE deploy_id = $1::uuid AND state = $3
       RETURNING state`,
      [deployId, to, from],
    );
    if (result.rows.length > 1) throw new Error("Deployment CAS updated more than one row");
    if (result.rows.length === 1) {
      if (String(result.rows[0]?.state) !== to) {
        throw new Error("Deployment CAS created receipt did not reach target state");
      }
      return { kind: "created", deployId, expectedState: from, observedState: to };
    }
    // A new statement gets a post-wait Read Committed snapshot after a concurrent CAS winner commits.
    const observed = await this.db.query(`SELECT state FROM deployments WHERE deploy_id = $1::uuid`, [deployId]);
    if (observed.rows.length > 1) throw new Error("Deployment CAS observed more than one row");
    const row = observed.rows[0];
    const observedState = row?.state == null ? null : String(row.state);
    if (observedState !== null && !(DEPLOYMENT_STATES as readonly string[]).includes(observedState)) {
      throw new Error("Deployment CAS returned an invalid state");
    }
    if (observedState === from) throw new Error("Deployment CAS stale receipt contradicts the expected state");
    return { kind: "stale", deployId, expectedState: from, observedState: observedState as DeploymentState | null };
  }

  private async transitionByTarget(
    owner: string,
    repo: string,
    commitSha: string,
    to: "monitoring" | "dispatch_failed",
  ): Promise<boolean> {
    if (!owner.trim() || !repo.trim() || !/^[0-9a-f]{40}$/.test(commitSha))
      throw new Error("Invalid deployment target");
    const result = await this.db.query(
      `WITH candidate AS (
         SELECT deploy_id
         FROM deployments
         WHERE github_owner = $1 AND github_repo = $2 AND commit_sha = $3
           AND env = 'prod' AND state = 'prod_deploying'
         ORDER BY created_at, deploy_id
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       UPDATE deployments
       SET state = $4, updated_at = now()
       FROM candidate
       WHERE deployments.deploy_id = candidate.deploy_id
       RETURNING deployments.deploy_id`,
      [owner, repo, commitSha, to],
    );
    return result.rows.length === 1;
  }

  async listMonitoringTargets(): Promise<MonitoringDeploymentTarget[]> {
    const result = await this.db.query(
      `SELECT d.deploy_id, d.project_id, d.github_owner, d.github_repo, d.commit_sha,
              COALESCE(
                jsonb_agg(DISTINCT jsonb_build_object('teamId', pc.team_id, 'channelId', pc.channel_id))
                  FILTER (WHERE pc.team_id IS NOT NULL AND pc.channel_id IS NOT NULL),
                '[]'::jsonb
              ) AS channels
       FROM deployments d
       LEFT JOIN project_channels pc
         ON pc.project_id = d.project_id
        AND pc.github_owner = d.github_owner
        AND pc.github_repo = d.github_repo
        AND pc.ingestion = 'active'
        AND pc.closed_at IS NULL
       WHERE d.state = 'monitoring'
       GROUP BY d.deploy_id, d.project_id, d.github_owner, d.github_repo, d.commit_sha
       ORDER BY d.updated_at, d.deploy_id
       LIMIT 100`,
    );
    return result.rows.map((row) => ({
      deployId: String(row.deploy_id),
      projectId: String(row.project_id),
      owner: String(row.github_owner),
      repo: String(row.github_repo),
      commitSha: String(row.commit_sha),
      channels: (Array.isArray(row.channels) ? row.channels : []).map((channel) => {
        const record = channel as Record<string, unknown>;
        return { teamId: String(record["teamId"] ?? ""), channelId: String(record["channelId"] ?? "") };
      }),
    }));
  }
}
