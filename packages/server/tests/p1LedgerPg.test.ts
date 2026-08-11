/** 根拠: FinalArch:CON-003 / FinalArch:CON-002 / FR-CP-005 / DELTA-03 / ADR-0020 */
// P1-T05 ledger の実 PostgreSQL 制約プローブ（レビュー所見 001〜006 の回帰固定）。
// TEST_DATABASE_URL がある環境（CI / 使い捨て DB）でのみ実行される。

import { readFile } from "node:fs/promises";

import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ActionLedgerRepo } from "../src/db/actionLedgerRepo.js";
import { IdMappingsRepo } from "../src/db/idMappingsRepo.js";
import { MeetingArtifactsRepo } from "../src/db/ledgerEvidenceRepos.js";
import { WorkflowRunsRepo } from "../src/db/workflowRunsRepo.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 4 }) : undefined;

const TRACE = "11111111-1111-1111-1111-111111111111";
const uuid = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;

describe.skipIf(!databaseUrl)("P1-T05 ledger real PostgreSQL constraints [FinalArch:CON-003 / DELTA-03]", () => {
  beforeAll(async () => {
    const schema = await readFile(new URL("../../devops/src/db/schema.sql", import.meta.url), "utf8");
    const ledgerMigration = await readFile(
      new URL("../../devops/src/db/migrations/202608110000_p1_ledger.sql", import.meta.url),
      "utf8",
    );
    await pool!.query(schema);
    // 冪等性: 同一 migration を 2 回適用してもエラーにならない
    await pool!.query(ledgerMigration);
    await pool!.query(ledgerMigration);
  });

  beforeEach(async () => {
    await pool!.query(
      "TRUNCATE workflow_runs, action_ledger, policy_decisions, model_invocations, tool_invocations, id_mappings, meeting_artifacts, agent_runs, deployments CASCADE",
    );
  });

  afterAll(async () => {
    await pool?.end();
  });

  async function startWorkflow(repo: WorkflowRunsRepo, runId = "run-1") {
    return repo.recordStart({
      workflowId: "incident/inc-1",
      runId,
      workflowType: "incident",
      businessKey: "inc-1",
      projectId: "PJ-1",
      traceId: TRACE,
      correlationId: TRACE,
      startedAt: "2026-08-11T00:00:00Z",
    });
  }

  it("DELTA-03: deployments 系 action は正本行への anchor を CHECK で強制する", async () => {
    const repo = new WorkflowRunsRepo(pool!);
    await startWorkflow(repo);
    const ledger = new ActionLedgerRepo(pool!);
    await expect(
      ledger.plan({
        operationId: uuid(1),
        workflowId: "incident/inc-1",
        system: "deployments",
        operation: "dispatch",
        resourceKey: "PJ-1/prod",
        inputHash: "h1",
        approvalId: null,
        deploymentId: null,
        traceId: TRACE,
      }),
    ).rejects.toThrow(/action_ledger_deployment_authority/u);

    const deploy = await pool!.query(
      `INSERT INTO deployments (project_id, commit_sha, env, state, trace_id)
       VALUES ('PJ-1', $1, 'prod', 'pending', $2) RETURNING deploy_id`,
      ["a".repeat(40), TRACE],
    );
    await expect(
      ledger.plan({
        operationId: uuid(2),
        workflowId: "incident/inc-1",
        system: "deployments",
        operation: "dispatch",
        resourceKey: "PJ-1/prod",
        inputHash: "h1",
        approvalId: null,
        deploymentId: String(deploy.rows[0]!.deploy_id),
        traceId: TRACE,
      }),
    ).resolves.toBe(true);
  });

  it("FR-CP-005: claimExecution は実 DB でも勝者 1 名のみ", async () => {
    const runs = new WorkflowRunsRepo(pool!);
    await startWorkflow(runs);
    const ledger = new ActionLedgerRepo(pool!);
    await ledger.plan({
      operationId: uuid(3),
      workflowId: "incident/inc-1",
      system: "github",
      operation: "create_pr",
      resourceKey: "o/r#b",
      inputHash: "h",
      approvalId: null,
      deploymentId: null,
      traceId: TRACE,
    });
    const [first, second] = await Promise.all([ledger.claimExecution(uuid(3)), ledger.claimExecution(uuid(3))]);
    expect([first, second].filter(Boolean)).toHaveLength(1);
    const row = await pool!.query("SELECT status, attempt_count FROM action_ledger WHERE operation_id = $1", [uuid(3)]);
    expect(row.rows[0]).toMatchObject({ status: "applying", attempt_count: 1 });
  });

  it("FinalArch:CON-002: active mapping は project スコープ論理キーごとに 1 行、cross-project は分離", async () => {
    const repo = new IdMappingsRepo(pool!);
    const base = {
      sourceSystem: "github",
      sourceObjectId: "issue-1",
      targetSystem: "plane",
      targetObjectId: "work-1",
      provenance: { by: "sync" },
    };
    await repo.addVersion({ ...base, projectId: "PJ-1", mappingVersion: 1 });
    await expect(
      pool!.query(
        `INSERT INTO id_mappings (project_id, source_system, source_object_id, target_system, target_object_id, mapping_version, provenance, active)
         VALUES ('PJ-1', 'github', 'issue-1', 'plane', 'work-2', 9, '{}'::jsonb, true)`,
      ),
    ).rejects.toThrow(/idx_id_mappings_one_active/u);

    await repo.addVersion({ ...base, projectId: "PJ-2", mappingVersion: 1 });
    await repo.addVersion({ ...base, projectId: "PJ-1", targetObjectId: "work-2", mappingVersion: 2 });

    const pj1 = await repo.findActive("PJ-1", "github", "issue-1", "plane");
    const pj2 = await repo.findActive("PJ-2", "github", "issue-1", "plane");
    expect(pj1).toMatchObject({ target_object_id: "work-2", mapping_version: "2" });
    expect(pj2).toMatchObject({ target_object_id: "work-1", mapping_version: "1" });
    const actives = await pool!.query("SELECT count(*)::int AS n FROM id_mappings WHERE active");
    expect(actives.rows[0]!.n).toBe(2);
  });

  it("replay 安全性: 同一 run は no-op、completed を退行させない。新 run は全状態リセット", async () => {
    const repo = new WorkflowRunsRepo(pool!);
    await startWorkflow(repo, "run-1");
    const before = await repo.findById("incident/inc-1");
    await repo.transition("incident/inc-1", Number(before!.version), "completed", "done", null);

    await expect(startWorkflow(repo, "run-1")).resolves.toBe(false);
    const replayed = await repo.findById("incident/inc-1");
    expect(replayed).toMatchObject({ status: "completed", current_step: "done" });
    expect(replayed!.completed_at).not.toBeNull();

    await expect(startWorkflow(repo, "run-2")).resolves.toBe(true);
    const replaced = await repo.findById("incident/inc-1");
    expect(replaced).toMatchObject({ status: "accepted", run_id: "run-2", current_step: null, waiting_reason: null });
    expect(replaced!.completed_at).toBeNull();
  });

  it("秘密情報: meeting artifact の外部 JSON は保存前に redact される", async () => {
    const repo = new MeetingArtifactsRepo(pool!);
    await repo.record({
      meetingArtifactId: uuid(7),
      m365MeetingId: "m365-1",
      wisprMeetingId: null,
      projectId: "PJ-1",
      sourceVersion: "v1",
      correlationConfidence: null,
      extraction: { note: "api_key=abcdefghijklmnopqrstuvwx" },
      publicationStatus: {},
      traceId: TRACE,
    });
    const stored = await pool!.query(
      "SELECT extraction::text AS x FROM meeting_artifacts WHERE m365_meeting_id = 'm365-1'",
    );
    expect(String(stored.rows[0]!.x)).not.toContain("abcdefghijklmnopqrstuvwx");
  });
});
