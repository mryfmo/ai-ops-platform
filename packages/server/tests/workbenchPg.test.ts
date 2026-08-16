/** 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-003 / FinalArch:FR-UI-005 / FinalArch:FR-UI-006 / ADR-0025 / UX-003 */
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WorkbenchRepo } from "../src/db/workbenchRepo.js";
import { applySchemaSerialized } from "./pgTestSchema.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const isolatedSchema = `p7t07_${randomUUID().replaceAll("-", "")}`;
const adminPool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 1 }) : undefined;
const pool = databaseUrl
  ? new Pool({ connectionString: databaseUrl, max: 2, options: `-c search_path=${isolatedSchema}` })
  : undefined;
const uuid = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const WORKSPACE_A = uuid(701);
const WORKSPACE_B = uuid(702);
const SOURCE_A = uuid(703);
const OPERATION_A = uuid(704);
const OPERATION_B = uuid(705);
const APPROVAL_A = uuid(706);
const APPROVAL_B = uuid(707);
const TRACE = uuid(708);
const TENANT = uuid(709);
const SUBJECT = uuid(710);

describe.skipIf(!databaseUrl)("Workbench real PostgreSQL references [FinalArch:FR-UI-006 / UX-003]", () => {
  beforeAll(async () => {
    // 他の real-PG suite は同じ TEST_DATABASE_URL の public tables を全行 cleanup する。
    // 固有 schema に閉じ、parallel coverage でも authority fixture を相互削除させない。
    await adminPool!.query(`CREATE SCHEMA "${isolatedSchema}"`);
    await applySchemaSerialized(pool!, [
      new URL("../../devops/src/db/schema.sql", import.meta.url),
      new URL("../../devops/src/db/migrations/202608160100_workbench_read_model.sql", import.meta.url),
      new URL("../../devops/src/db/migrations/202608160100_workbench_read_model.sql", import.meta.url),
    ]);

    await pool!.query("DELETE FROM workbench_pending_actions WHERE workspace_id IN ($1, $2)", [
      WORKSPACE_A,
      WORKSPACE_B,
    ]);
    await pool!.query("DELETE FROM workbench_workspace_runs WHERE workspace_id IN ($1, $2)", [
      WORKSPACE_A,
      WORKSPACE_B,
    ]);
    await pool!.query("DELETE FROM workbench_workspace_sources WHERE workspace_id IN ($1, $2)", [
      WORKSPACE_A,
      WORKSPACE_B,
    ]);
    await pool!.query("DELETE FROM workbench_workspaces WHERE workspace_id IN ($1, $2)", [WORKSPACE_A, WORKSPACE_B]);
    await pool!.query("DELETE FROM action_ledger WHERE operation_id IN ($1, $2)", [OPERATION_A, OPERATION_B]);
    await pool!.query("DELETE FROM workflow_runs WHERE workflow_id IN ('incident/wb-a', 'incident/wb-b')");
    await pool!.query("DELETE FROM approvals WHERE approval_id IN ($1, $2)", [APPROVAL_A, APPROVAL_B]);
    await pool!.query("DELETE FROM recipients WHERE user_id = 'p7t07-owner'");

    await pool!.query(
      `INSERT INTO recipients (
         user_id, profile, email, projects, active, entra_tenant_id, entra_object_id,
         scope_mode, backfill_disposition, backfill_state
       ) VALUES ('p7t07-owner', 'PRF-L', 'owner@example.test', ARRAY['PJ-WB-A'], true,
                 $1, $2, 'project', 'migrate_active', 'applied')`,
      [TENANT, SUBJECT],
    );
    await pool!.query(
      `INSERT INTO approvals (approval_id, approval_type, target_id, project_id, requested_by)
       VALUES ($1, 'change', 'wb-a', 'PJ-WB-A', 'p7t07'), ($2, 'change', 'wb-b', 'PJ-WB-B', 'p7t07')`,
      [APPROVAL_A, APPROVAL_B],
    );
    await pool!.query(
      `INSERT INTO workflow_runs (
         workflow_id, run_id, workflow_type, business_key, project_id, status,
         trace_id, correlation_id, started_at
       ) VALUES
         ('incident/wb-a', 'run-a', 'incident', 'wb-a', 'PJ-WB-A', 'running', $1, $1, now()),
         ('incident/wb-b', 'run-b', 'incident', 'wb-b', 'PJ-WB-B', 'running', $1, $1, now())`,
      [TRACE],
    );
    await pool!.query(
      `INSERT INTO action_ledger (
         operation_id, workflow_id, system, operation, resource_key, input_hash,
         status, approval_id, trace_id
       ) VALUES
         ($1, 'incident/wb-a', 'github', 'merge', 'repo-a', 'hash-a', 'approval_pending', $2, $5),
         ($3, 'incident/wb-b', 'github', 'merge', 'repo-b', 'hash-b', 'approval_pending', $4, $5)`,
      [OPERATION_A, APPROVAL_A, OPERATION_B, APPROVAL_B, TRACE],
    );
  });

  afterAll(async () => {
    await pool?.end();
    await adminPool?.query(`DROP SCHEMA IF EXISTS "${isolatedSchema}" CASCADE`);
    await adminPool?.end();
  });

  it("stores only workspace metadata and authority/source references", async () => {
    await expect(pool!.query("SELECT current_schema() AS schema")).resolves.toMatchObject({
      rows: [{ schema: isolatedSchema }],
    });
    const expected = {
      workbench_workspaces: ["workspace_id", "kind", "project_id", "owner_user_id", "created_at"],
      workbench_workspace_sources: [
        "source_ref_id",
        "workspace_id",
        "source_system",
        "source_type",
        "external_id",
        "canonical_url",
        "linked_at",
      ],
      workbench_workspace_runs: ["workspace_id", "workflow_id", "linked_at"],
      workbench_pending_actions: ["workspace_id", "operation_id", "approval_id", "linked_at"],
    } as const;

    for (const [table, columns] of Object.entries(expected)) {
      const result = await pool!.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = $1 ORDER BY ordinal_position`,
        [table],
      );
      expect(result.rows.map((row) => row.column_name)).toEqual(columns);
    }
  });

  it("links same-project authority rows and reads current state live", async () => {
    const repo = new WorkbenchRepo(pool!);
    await expect(
      repo.createWorkspace({
        workspaceId: WORKSPACE_A,
        kind: "project",
        projectId: "PJ-WB-A",
        ownerUserId: "p7t07-owner",
      }),
    ).resolves.toBe(true);
    await expect(
      repo.addSource({
        sourceRefId: SOURCE_A,
        workspaceId: WORKSPACE_A,
        sourceSystem: "github",
        sourceType: "repository",
        externalId: "mryfmo/ai-ops-platform",
        canonicalUrl: "https://github.com/mryfmo/ai-ops-platform",
      }),
    ).resolves.toBe(true);
    await expect(repo.linkRun(WORKSPACE_A, "incident/wb-a")).resolves.toBe(true);
    await expect(repo.linkPendingAction(WORKSPACE_A, OPERATION_A)).resolves.toBe(true);

    const recipient = { profile: "PRF-L", scopeMode: "project" as const, projects: ["PJ-WB-A"] };
    await expect(repo.findByIdFor(recipient, WORKSPACE_A)).resolves.toMatchObject({
      workspaceId: WORKSPACE_A,
      projectId: "PJ-WB-A",
      sources: [{ sourceSystem: "github", externalId: "mryfmo/ai-ops-platform" }],
      runs: [{ workflowId: "incident/wb-a", status: "running" }],
      pendingActions: [
        {
          operationId: OPERATION_A,
          approvalId: APPROVAL_A,
          actionStatus: "approval_pending",
          approvalStatus: "pending",
        },
      ],
    });

    await pool!.query(
      "UPDATE workflow_runs SET status = 'completed', updated_at = now() WHERE workflow_id = 'incident/wb-a'",
    );
    await pool!.query(
      `UPDATE approvals SET status = 'approved', approver_tenant_id = $2, approver_object_id = $3,
         decided_at = now() WHERE approval_id = $1`,
      [APPROVAL_A, TENANT, SUBJECT],
    );
    await expect(repo.findByIdFor(recipient, WORKSPACE_A)).resolves.toMatchObject({
      runs: [{ status: "completed" }],
      pendingActions: [{ approvalStatus: "approved" }],
    });
  });

  it("rejects cross-project run/action links and non-HTTPS source references", async () => {
    const repo = new WorkbenchRepo(pool!);
    await repo.createWorkspace({
      workspaceId: WORKSPACE_B,
      kind: "incident",
      projectId: "PJ-WB-A",
      ownerUserId: "p7t07-owner",
    });

    await expect(repo.linkRun(WORKSPACE_B, "incident/wb-b")).resolves.toBe(false);
    await expect(repo.linkPendingAction(WORKSPACE_B, OPERATION_B)).resolves.toBe(false);
    await expect(
      repo.addSource({
        sourceRefId: uuid(711),
        workspaceId: WORKSPACE_B,
        sourceSystem: "sharepoint",
        sourceType: "document",
        externalId: "doc-1",
        canonicalUrl: "http://untrusted.example/doc-1",
      }),
    ).rejects.toThrow(/workbench_workspace_sources_canonical_url_check/u);
  });
});
