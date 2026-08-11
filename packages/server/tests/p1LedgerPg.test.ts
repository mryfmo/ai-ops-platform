/** 根拠: FinalArch:CON-003 / FinalArch:CON-002 / FR-CP-005 / DELTA-03 / ADR-0020 */
// P1-T05 ledger の実 PostgreSQL 制約プローブ（レビュー所見 001〜006 の回帰固定）。
// TEST_DATABASE_URL がある環境（CI / 使い捨て DB）でのみ実行される。

import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ActionLedgerRepo } from "../src/db/actionLedgerRepo.js";
import { IdMappingsRepo } from "../src/db/idMappingsRepo.js";
import { MeetingArtifactsRepo } from "../src/db/ledgerEvidenceRepos.js";
import { WorkflowRunsRepo } from "../src/db/workflowRunsRepo.js";
import { applySchemaSerialized } from "./pgTestSchema.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 4 }) : undefined;

const TRACE = "11111111-1111-1111-1111-111111111111";
const uuid = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;

describe.skipIf(!databaseUrl)("P1-T05 ledger real PostgreSQL constraints [FinalArch:CON-003 / DELTA-03]", () => {
  beforeAll(async () => {
    // 冪等性: 同一 migration を 2 回適用してもエラーにならない（advisory lock で
    // 他 PG テストファイルの schema 適用と直列化）
    await applySchemaSerialized(pool!, [
      new URL("../../devops/src/db/schema.sql", import.meta.url),
      new URL("../../devops/src/db/migrations/202608110000_p1_ledger.sql", import.meta.url),
      new URL("../../devops/src/db/migrations/202608110000_p1_ledger.sql", import.meta.url),
    ]);
  });

  beforeEach(async () => {
    // 並行テストファイルの行を巻き込む TRUNCATE CASCADE は使わない。
    // 子→親の FK 順に本 suite のテーブルを空にし、共有テーブル deployments は
    // 自 suite の trace_id 行だけを消す
    for (const table of [
      "tool_invocations",
      "action_ledger",
      "policy_decisions",
      "model_invocations",
      "meeting_artifacts",
      "id_mappings",
      "id_mapping_heads",
      "agent_runs",
      "workflow_runs",
    ]) {
      await pool!.query(`DELETE FROM ${table}`);
    }
    await pool!.query("DELETE FROM deployments WHERE trace_id = $1", [TRACE]);
    await pool!.query("DELETE FROM approvals WHERE requested_by = 'p1t05-suite'");
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

    // unknown は claim できない（非冪等書き込みの再送防止）。resolveUnknown でのみ確定
    await pool!.query("UPDATE action_ledger SET status = 'unknown' WHERE operation_id = $1", [uuid(3)]);
    await expect(ledger.claimExecution(uuid(3))).resolves.toBe(false);
    await expect(ledger.resolveUnknown(uuid(3), "applied")).resolves.toBe(true);
    const resolved = await pool!.query("SELECT status FROM action_ledger WHERE operation_id = $1", [uuid(3)]);
    expect(resolved.rows[0]).toMatchObject({ status: "applied" });
  });

  it("DELTA-03: cross-project の approval / deployment anchor は拒否される", async () => {
    const runs = new WorkflowRunsRepo(pool!);
    await startWorkflow(runs); // PJ-1
    const ledger = new ActionLedgerRepo(pool!);
    const approvalB = await pool!.query(
      `INSERT INTO approvals (approval_type, target_id, project_id, requested_by)
       VALUES ('change', 't-p1t05-xproj', 'PJ-B', 'p1t05-suite') RETURNING approval_id`,
    );
    await expect(
      ledger.plan({
        operationId: uuid(8),
        workflowId: "incident/inc-1",
        system: "github",
        operation: "op",
        resourceKey: "k1",
        inputHash: "h8",
        approvalId: String(approvalB.rows[0]!.approval_id),
        deploymentId: null,
        traceId: TRACE,
      }),
    ).rejects.toThrow(/cross-project/u);

    const deployB = await pool!.query(
      `INSERT INTO deployments (project_id, commit_sha, env, state, trace_id)
       VALUES ('PJ-B', $1, 'prod', 'pending', $2) RETURNING deploy_id`,
      ["b".repeat(40), TRACE],
    );
    await expect(
      ledger.plan({
        operationId: uuid(9),
        workflowId: "incident/inc-1",
        system: "deployments",
        operation: "dispatch",
        resourceKey: "k2",
        inputHash: "h9",
        approvalId: null,
        deploymentId: String(deployB.rows[0]!.deploy_id),
        traceId: TRACE,
      }),
    ).rejects.toThrow(/cross-project/u);
  });

  it("FinalArch:CON-002: head は project スコープ論理キーごとに 1 行、cross-project は分離", async () => {
    const repo = new IdMappingsRepo(pool!);
    const base = {
      sourceSystem: "github",
      sourceObjectId: "issue-1",
      targetSystem: "plane",
      targetObjectId: "work-1",
      provenance: { by: "sync" },
    };
    await repo.addVersion({ ...base, projectId: "PJ-1", mappingVersion: 1 });
    // 同一版の重複履歴は unique が拒否（同版 divergent target の防止）
    await expect(
      pool!.query(
        `INSERT INTO id_mappings (project_id, source_system, source_object_id, target_system, target_object_id, mapping_version, provenance)
         VALUES ('PJ-1', 'github', 'issue-1', 'plane', 'work-2', 1, '{}'::jsonb)`,
      ),
    ).rejects.toThrow(/duplicate key/u);

    await repo.addVersion({ ...base, projectId: "PJ-2", mappingVersion: 1 });
    await repo.addVersion({ ...base, projectId: "PJ-1", targetObjectId: "work-2", mappingVersion: 2 });

    const pj1 = await repo.findActive("PJ-1", "github", "issue-1", "plane");
    const pj2 = await repo.findActive("PJ-2", "github", "issue-1", "plane");
    expect(pj1).toMatchObject({ target_object_id: "work-2", mapping_version: "2" });
    expect(pj2).toMatchObject({ target_object_id: "work-1", mapping_version: "1" });
    const heads = await pool!.query(
      "SELECT count(*)::int AS n FROM id_mapping_heads WHERE source_object_id = 'issue-1'",
    );
    expect(heads.rows[0]!.n).toBe(2);

    // 単調 version CAS: stale 版（v1）は現行 head（v2）を置換しない
    await expect(repo.addVersion({ ...base, projectId: "PJ-1", mappingVersion: 1 })).resolves.toBe(false);
    const still = await repo.findActive("PJ-1", "github", "issue-1", "plane");
    expect(still).toMatchObject({ target_object_id: "work-2", mapping_version: "2" });
  });

  it("DELTA-03: 冪等キー衝突でも workflow/authority scope が違えば合流させない", async () => {
    const runs = new WorkflowRunsRepo(pool!);
    await startWorkflow(runs); // incident/inc-1, PJ-1
    await runs.recordStart({
      workflowId: "incident/inc-b",
      runId: "run-b",
      workflowType: "incident",
      businessKey: "inc-b",
      projectId: "PJ-B",
      traceId: TRACE,
      correlationId: TRACE,
      startedAt: "2026-08-11T00:00:00Z",
    });
    const ledger = new ActionLedgerRepo(pool!);
    const tuple = {
      system: "github",
      operation: "op",
      resourceKey: "shared-key",
      inputHash: "h-shared",
      approvalId: null,
      deploymentId: null,
      traceId: TRACE,
    };
    await expect(ledger.plan({ ...tuple, operationId: uuid(10), workflowId: "incident/inc-b" })).resolves.toBe(true);
    await expect(ledger.plan({ ...tuple, operationId: uuid(11), workflowId: "incident/inc-1" })).rejects.toThrow(
      /different workflow\/authority scope/u,
    );
    await expect(ledger.plan({ ...tuple, operationId: uuid(12), workflowId: "incident/inc-b" })).resolves.toBe(false);
  });

  it("FinalArch:CON-002: 並行 addVersion は head upsert で高い版へ収束し、初回並行は勝者 1", async () => {
    const repo = new IdMappingsRepo(pool!);
    const base = {
      projectId: "PJ-9",
      sourceSystem: "github",
      sourceObjectId: "issue-9",
      targetSystem: "plane",
      provenance: { by: "race" },
    };
    // 初回並行 v1/v1: 勝者 1、head 1 行
    const firstPair = await Promise.all([
      repo.addVersion({ ...base, targetObjectId: "w-a", mappingVersion: 1 }),
      repo.addVersion({ ...base, targetObjectId: "w-b", mappingVersion: 1 }),
    ]);
    expect(firstPair.filter(Boolean)).toHaveLength(1);

    // 並行 v2/v3: どちらの順でも最終 head は v3（throw しない。v3 先勝ちなら v2 は stale）
    const racePair = await Promise.all([
      repo.addVersion({ ...base, targetObjectId: "w-v2", mappingVersion: 2 }),
      repo.addVersion({ ...base, targetObjectId: "w-v3", mappingVersion: 3 }),
    ]);
    const active = await repo.findActive("PJ-9", "github", "issue-9", "plane");
    expect(active).toMatchObject({ target_object_id: "w-v3", mapping_version: "3" });
    const count = await pool!.query("SELECT count(*)::int AS n FROM id_mapping_heads WHERE project_id = 'PJ-9'");
    expect(count.rows[0]!.n).toBe(1);
    // 履歴は「受理された呼び出し」と 1:1 で追記される（順序非依存の決定的検証）
    const accepted = [...firstPair, ...racePair].filter(Boolean).length;
    const history = await pool!.query("SELECT count(*)::int AS n FROM id_mappings WHERE project_id = 'PJ-9'");
    expect(history.rows[0]!.n).toBe(accepted);
    expect(history.rows[0]!.n).toBeGreaterThanOrEqual(2);
  });

  it("FinalArch:CON-002: explicit transaction の client 同士でも addVersion は直列化され 25P02 にならない", async () => {
    const repo = new IdMappingsRepo(pool!);
    const base = {
      projectId: "PJ-TX",
      sourceSystem: "github",
      sourceObjectId: "issue-tx",
      targetSystem: "plane",
      provenance: { by: "tx" },
    };
    const clientA = await pool!.connect();
    const clientB = await pool!.connect();
    try {
      await clientA.query("BEGIN");
      await clientB.query("BEGIN");
      const repoA = new IdMappingsRepo(clientA);
      const repoB = new IdMappingsRepo(clientB);
      await expect(repoA.addVersion({ ...base, targetObjectId: "w-v2", mappingVersion: 2 })).resolves.toBe(true);
      // B は head 行の upsert 競合（speculative insertion / row lock）で A の commit まで
      // 待たされ、EvalPlanQual が最新行と比較して収束する（エラーにならない）
      const pending = repoB.addVersion({ ...base, targetObjectId: "w-v3", mappingVersion: 3 });
      await new Promise((resolve) => setTimeout(resolve, 100));
      await clientA.query("COMMIT");
      await expect(pending).resolves.toBe(true);
      await clientB.query("COMMIT");
    } finally {
      clientA.release();
      clientB.release();
    }
    const active = await repo.findActive("PJ-TX", "github", "issue-tx", "plane");
    expect(active).toMatchObject({ target_object_id: "w-v3", mapping_version: "3" });
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
