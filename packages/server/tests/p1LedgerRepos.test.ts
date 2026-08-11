/** 根拠: FinalArch:CON-003 / FinalArch:CON-004 / FinalArch:CON-005 / FinalArch:FR-CP-001 / ADR-0020 / ADR-0027 */
import { describe, expect, it, vi } from "vitest";

import { ActionLedgerRepo } from "../src/db/actionLedgerRepo.js";
import { AgentRunsRepo } from "../src/db/agentRunsRepo.js";
import { IdMappingsRepo } from "../src/db/idMappingsRepo.js";
import {
  MeetingArtifactsRepo,
  ModelInvocationsRepo,
  PolicyDecisionsRepo,
  ToolInvocationsRepo,
} from "../src/db/ledgerEvidenceRepos.js";
import { WorkflowRunsRepo } from "../src/db/workflowRunsRepo.js";

const start = {
  workflowId: "meeting/2026-08-11-standup",
  runId: "run-1",
  workflowType: "meeting",
  businessKey: "2026-08-11-standup",
  projectId: "PJ-1",
  traceId: "11111111-1111-1111-1111-111111111111",
  correlationId: "22222222-2222-2222-2222-222222222222",
  startedAt: "2026-08-11T00:00:00Z",
};

describe("WorkflowRunsRepo [FinalArch:FR-CP-001 / FinalArch:CON-003]", () => {
  it("recordStart は同一 run replay を no-op、新 run は全状態リセットで置換する", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const repo = new WorkflowRunsRepo({ query });
    await expect(repo.recordStart(start)).resolves.toBe(true);
    await expect(repo.recordStart(start)).resolves.toBe(false);
    const sql = String(query.mock.calls[0]![0]);
    expect(sql).toContain("ON CONFLICT (workflow_id) DO UPDATE");
    expect(sql).toContain("WHERE workflow_runs.run_id <> EXCLUDED.run_id");
    expect(sql).toContain("completed_at = NULL");
    expect(sql).toContain("version = workflow_runs.version + 1");
    expect(query.mock.calls[0]![1]).toEqual([
      start.workflowId,
      start.runId,
      start.workflowType,
      start.businessKey,
      start.projectId,
      start.traceId,
      start.correlationId,
      start.startedAt,
    ]);
  });

  it("transition は version CAS で更新し、競合時 false（境界値）", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const repo = new WorkflowRunsRepo({ query });
    await expect(repo.transition("meeting/k", 3, "running", "extract", null)).resolves.toBe(true);
    await expect(repo.transition("meeting/k", 3, "running", "extract", null)).resolves.toBe(false);
    expect(String(query.mock.calls[0]![0])).toContain("WHERE workflow_id = $1 AND version = $2");
  });
});

describe("ActionLedgerRepo [FinalArch:CON-003 / DELTA-03]", () => {
  const op = {
    operationId: "33333333-3333-3333-3333-333333333333",
    workflowId: "meeting/k",
    system: "github",
    operation: "create_pr",
    resourceKey: "owner/repo#branch",
    inputHash: "abc",
    approvalId: null,
    deploymentId: null,
    traceId: "11111111-1111-1111-1111-111111111111",
  };

  it("plan は冪等キー重複で false、workflow/authority 不整合で RangeError", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [{ workflow_id: "meeting/k", approval_id: null, deployment_id: null }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [{ workflow_id: "other/wf", approval_id: null, deployment_id: null }],
        rowCount: 1,
      });
    const repo = new ActionLedgerRepo({ query });
    await expect(repo.plan(op)).resolves.toBe(true);
    await expect(repo.plan(op)).resolves.toBe(false);
    await expect(repo.plan(op)).rejects.toThrow(RangeError);
    const sql = String(query.mock.calls[0]![0]);
    expect(sql).toContain("ON CONFLICT (system, operation, resource_key, input_hash) DO NOTHING");
    expect(sql).toContain("a.project_id IS NOT DISTINCT FROM w.project_id");
    expect(sql).toContain("d.project_id IS NOT DISTINCT FROM w.project_id");
  });

  it("claimExecution は条件付き UPDATE で勝者のみ true（重複 worker 直列化）", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const repo = new ActionLedgerRepo({ query });
    await expect(repo.claimExecution(op.operationId)).resolves.toBe(true);
    await expect(repo.claimExecution(op.operationId)).resolves.toBe(false);
    const sql = String(query.mock.calls[0]![0]);
    expect(sql).toContain("WHERE operation_id = $1 AND status IN ('planned', 'approved', 'failed')");
    expect(sql).toContain("attempt_count = attempt_count + 1");
  });

  it("updateStatus は applying への遷移を拒否する（claim 経由を強制）", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    const repo = new ActionLedgerRepo({ query });
    await expect(repo.updateStatus(op.operationId, "applying" as unknown as "applied")).rejects.toThrow(RangeError);
    await repo.updateStatus(op.operationId, "applied");
    expect(String(query.mock.calls[0]![0])).not.toContain("attempt_count");
  });
});

describe("証跡 ledger repos [FinalArch:CON-004 / FinalArch:CON-005 / FinalArch:PRD-003 / FinalArch:PRD-005]", () => {
  it("PolicyDecisionsRepo.record は JSONB 列を文字列化して渡す", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    await new PolicyDecisionsRepo({ query }).record({
      decisionId: "d-1",
      workflowId: null,
      actorId: "actor",
      action: "tool.invoke",
      resource: { system: "plane" },
      inputHash: "h",
      policyBundleVersion: "1.0",
      decision: "deny",
      reasons: ["default_deny"],
      obligations: [],
      traceId: "t",
    });
    const params = query.mock.calls[0]![1] as unknown[];
    expect(params[4]).toBe(JSON.stringify({ system: "plane" }));
    expect(params[8]).toBe(JSON.stringify(["default_deny"]));
  });

  it("ToolInvocationsRepo は approvals(approval_id) 参照で記録する（並行承認正本なし）", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    await new ToolInvocationsRepo({ query }).record({
      invocationId: "i-1",
      workflowId: null,
      serverId: "plane",
      serverVersion: "1",
      toolName: "draft",
      riskLevel: "L2",
      resourceScope: {},
      policyDecisionId: "d-1",
      approvalId: "a-1",
      latencyMs: 10,
      status: "ok",
      errorClass: null,
      traceId: "t",
    });
    expect(String(query.mock.calls[0]![0])).toContain("approval_id");
  });

  it("ModelInvocationsRepo.record は 14 パラメタを順序どおり渡す", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    await new ModelInvocationsRepo({ query }).record({
      invocationId: "m-1",
      workflowId: null,
      modelAlias: "report-writer",
      providerBinding: "bedrock",
      providerModelRevision: "r1",
      routeReason: "policy",
      classification: "internal",
      inputTokens: 1,
      outputTokens: 2,
      costUsd: "0.001",
      latencyMs: 100,
      status: "ok",
      errorClass: null,
      traceId: "t",
    });
    expect((query.mock.calls[0]![1] as unknown[]).length).toBe(14);
  });

  it("MeetingArtifactsRepo.record は (meeting, source_version) 冪等（重複時 false）", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const repo = new MeetingArtifactsRepo({ query });
    const artifact = {
      meetingArtifactId: "ma-1",
      m365MeetingId: "m365-1",
      wisprMeetingId: null,
      projectId: null,
      sourceVersion: "v1",
      correlationConfidence: null,
      extraction: { note: "api_key=abcdefghijklmnopqrstuvwx" },
      publicationStatus: {},
      traceId: "t",
    };
    await expect(repo.record(artifact)).resolves.toBe(true);
    await expect(repo.record(artifact)).resolves.toBe(false);
    expect(String(query.mock.calls[0]![0])).toContain("ON CONFLICT (m365_meeting_id, source_version) DO NOTHING");
    const storedExtraction = String((query.mock.calls[0]![1] as unknown[])[6]);
    expect(storedExtraction).not.toContain("abcdefghijklmnopqrstuvwx");
  });
});

describe("IdMappingsRepo [FinalArch:CON-002]", () => {
  it("addVersion は head upsert の単調 CAS（stale は false、履歴は追記のみ）", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const repo = new IdMappingsRepo({ query });
    await expect(
      repo.addVersion({
        projectId: "PJ-1",
        sourceSystem: "github",
        sourceObjectId: "issue-1",
        targetSystem: "plane",
        targetObjectId: "work-1",
        mappingVersion: 2,
        provenance: { by: "sync" },
      }),
    ).resolves.toBe(true);
    await expect(
      repo.addVersion({
        projectId: "PJ-1",
        sourceSystem: "github",
        sourceObjectId: "issue-1",
        targetSystem: "plane",
        targetObjectId: "work-1",
        mappingVersion: 1,
        provenance: { by: "stale" },
      }),
    ).resolves.toBe(false);
    const sql = String(query.mock.calls[0]![0]);
    expect(sql).toContain("WHERE h.mapping_version < EXCLUDED.mapping_version");
    expect(sql).toContain("INSERT INTO id_mappings");
    expect(sql).not.toContain("DELETE");
    expect(sql).not.toContain("UPDATE id_mappings");
  });

  it("findActive は head 表を project_id 必須条件で引く（cross-project 遮断）", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    await new IdMappingsRepo({ query }).findActive("PJ-1", "github", "issue-1", "plane");
    const sql = String(query.mock.calls[0]![0]);
    expect(sql).toContain("FROM id_mapping_heads");
    expect(sql).toContain("WHERE project_id = $1");
  });
});

describe("AgentRunsRepo [ADR-0027 / FinalArch:GOV-005]", () => {
  it("recordStart は task_id 冪等（重複時 false）", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const repo = new AgentRunsRepo({ query });
    const run = {
      agentRunId: "ar-1",
      workflowId: null,
      taskId: "P1-T05",
      writer: "claude-code-fable5-xhigh",
      reviewer: "codex-gpt56-sol-high",
      allowedPaths: ["packages/devops/src/db/**"],
      acceptanceGateIds: ["CON-003"],
      traceId: "t",
    };
    await expect(repo.recordStart(run)).resolves.toBe(true);
    await expect(repo.recordStart(run)).resolves.toBe(false);
    expect(String(query.mock.calls[0]![0])).toContain("ON CONFLICT (task_id) DO NOTHING");
  });

  it("recordProgress は execution_evidence へ JSONB append する（上書きしない）", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    await new AgentRunsRepo({ query }).recordProgress("P1-T05", "pr_created", {
      pullRequestUrl: "https://example.invalid/pr/1",
      evidence: { ci: "green" },
    });
    const sql = String(query.mock.calls[0]![0]);
    expect(sql).toContain("execution_evidence || $6::jsonb");
    expect((query.mock.calls[0]![1] as unknown[])[5]).toBe(JSON.stringify([{ ci: "green" }]));
  });
});
