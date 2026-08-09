/**
 * packages/server/tests/devopsEventHandlers.test.ts
 *
 * 根拠: DevOps:REQ-001 / DevOps:REQ-002 / DevOps:REQ-015,
 * DevOps:SPEC-INT-011 / DevOps:SPEC-INT-030, ADR-0014。
 */
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { InMemoryAuditLog, sanitizeSecrets } from "@aiops/shared";
import {
  ALERT_LABEL,
  createBuildEventHandler,
  createDeployEventHandler,
  createIncidentEventHandler,
  createIncidentIssueClient,
  createRecencySimilarIncidentsProvider,
} from "../src/agents/devopsEventHandlers.js";

const fakeGitHubToken = ["ghp", "_abcdefghijklmnopqrstuvwxyz123456"].join("");

const workflowFailure = {
  targetAgent: "AGT_BLD" as const,
  eventName: "workflow_run",
  payload: {
    action: "completed",
    repository: { full_name: "acme/widget" },
    workflow_run: {
      id: 456,
      conclusion: "failure",
      html_url: "https://github.com/acme/widget/actions/runs/456",
      pull_requests: [{ number: 42, base: { repo: { full_name: "acme/widget" } } }],
    },
  },
};

const workflowSuccess = {
  targetAgent: "AGT_DEP" as const,
  eventName: "workflow_run",
  payload: {
    action: "completed",
    repository: { full_name: "acme/widget" },
    workflow_run: { id: 789, conclusion: "success", head_sha: "a".repeat(40) },
  },
};

describe("AGT_DEP staging runtime wiring [DevOps:REQ-003 / TH-001]", () => {
  it("CI successと同一commitのcoverageとcritical=0をTH-001へ渡す", async () => {
    const promote = vi.fn(async () => true);
    const handler = createDeployEventHandler({
      configured: true,
      channel: { teamId: "team", channelId: "channel" },
      coverageEvidence: {
        read: vi.fn(async () => ({ commitSha: "a".repeat(40), unitTestCoveragePct: 80 })),
      },
      criticalCountEvidence: { read: vi.fn(async () => 0) },
      auditLog: new InMemoryAuditLog(),
      promote,
    });

    await handler(workflowSuccess, "trace-deploy");

    expect(promote).toHaveBeenCalledWith(
      { ciAllJobsSuccess: true, unitTestCoveragePct: 80, staticAnalysisCriticalCount: 0 },
      { teamId: "team", channelId: "channel" },
      "aaaaaaa",
      "trace-deploy",
    );
  });

  it("D-16 critical正本が無ければcoverageを0扱いせず昇格を止めて監査する", async () => {
    const auditLog = new InMemoryAuditLog();
    const promote = vi.fn();
    const handler = createDeployEventHandler({
      configured: true,
      channel: { teamId: "team", channelId: "channel" },
      coverageEvidence: { read: vi.fn(async () => ({ commitSha: "a".repeat(40), unitTestCoveragePct: 99 })) },
      criticalCountEvidence: { read: vi.fn(async () => null) },
      auditLog,
      promote,
    });

    await handler(workflowSuccess, "trace-missing-critical");

    expect(promote).not.toHaveBeenCalled();
    expect((await auditLog.readAll()).map((record) => record.action)).toContain("staging_promotion_input_missing");
  });

  it("coverage commitがworkflow headと一致しなければfail closedにする", async () => {
    const auditLog = new InMemoryAuditLog();
    const promote = vi.fn();
    const handler = createDeployEventHandler({
      configured: true,
      channel: { teamId: "team", channelId: "channel" },
      coverageEvidence: { read: vi.fn(async () => ({ commitSha: "b".repeat(40), unitTestCoveragePct: 99 })) },
      criticalCountEvidence: { read: vi.fn(async () => 0) },
      auditLog,
      promote,
    });

    await handler(workflowSuccess, "trace-mismatch");

    expect(promote).not.toHaveBeenCalled();
    expect((await auditLog.readAll()).map((record) => record.action)).toContain("staging_promotion_input_missing");
  });

  it("deploy-prod workflow成功は対応するprod_deploying rowだけをmonitoringへ進める", async () => {
    const markMonitoring = vi.fn(async () => true);
    const promote = vi.fn();
    const handler = createDeployEventHandler({
      configured: false,
      coverageEvidence: { read: vi.fn() },
      criticalCountEvidence: { read: vi.fn() },
      deploymentState: { markMonitoring, markWorkflowFailed: vi.fn() },
      auditLog: new InMemoryAuditLog(),
      promote,
    });

    await handler(
      {
        ...workflowSuccess,
        payload: {
          ...workflowSuccess.payload,
          workflow_run: { ...workflowSuccess.payload.workflow_run, path: ".github/workflows/deploy-prod.yml" },
        },
      },
      "trace-prod-complete",
    );

    expect(markMonitoring).toHaveBeenCalledWith("acme", "widget", "a".repeat(40));
    expect(promote).not.toHaveBeenCalled();
  });

  it("deploy-prod workflow失敗は対応するprod_deploying rowをdispatch_failedへ終端する", async () => {
    const markWorkflowFailed = vi.fn(async () => true);
    const promote = vi.fn();
    const handler = createDeployEventHandler({
      configured: false,
      coverageEvidence: { read: vi.fn() },
      criticalCountEvidence: { read: vi.fn() },
      deploymentState: { markMonitoring: vi.fn(), markWorkflowFailed },
      auditLog: new InMemoryAuditLog(),
      promote,
    });

    await handler(
      {
        ...workflowSuccess,
        payload: {
          ...workflowSuccess.payload,
          workflow_run: {
            ...workflowSuccess.payload.workflow_run,
            conclusion: "failure",
            path: ".github/workflows/deploy-prod.yml",
          },
        },
      },
      "trace-prod-failed",
    );

    expect(markWorkflowFailed).toHaveBeenCalledWith("acme", "widget", "a".repeat(40));
    expect(promote).not.toHaveBeenCalled();
  });
});

describe("AGT_BLD runtime wiring [DevOps:SPEC-INT-011 / DevOps:REQ-001 / DevOps:REQ-002]", () => {
  it("失敗ログを分類して単一のcanonical PRへサニタイズ済み提案を投稿する", async () => {
    const auditLog = new InMemoryAuditLog();
    const getWorkflowRunFailureLog = vi.fn(async () => `failed token ${fakeGitHubToken}`);
    const createIssueComment = vi.fn(async () => undefined);
    const createIssue = vi.fn(async () => ({ number: 9, htmlUrl: "https://github.com/acme/widget/issues/9" }));
    const classify = vi.fn(async () => ({
      classification: "test_failure" as const,
      failed_job: "test",
      failed_step: "vitest",
      log_excerpt: fakeGitHubToken,
      confidence: 0.91,
    }));
    const generate = vi.fn(async () => `\`\`\`diff\n+token=${fakeGitHubToken}\n\`\`\``);
    const handler = createBuildEventHandler({
      configured: true,
      githubClient: { getWorkflowRunFailureLog, createIssueComment, createIssue },
      auditLog,
      classify,
      generate,
      repoCheckoutPathFor: () => "/repo",
    });

    await handler(workflowFailure, "trace-build");

    expect(classify).toHaveBeenCalledWith(expect.stringContaining("failed token"), expect.anything());
    expect(generate).toHaveBeenCalledOnce();
    expect(createIssue).not.toHaveBeenCalled();
    expect(createIssueComment).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "acme", repo: "widget", issueOrPrNumber: 42 }),
    );
    const body = createIssueComment.mock.calls[0]![0].body;
    expect(body).not.toContain(fakeGitHubToken);
    expect(sanitizeSecrets(body).redactionCount).toBe(0);
  });

  it("confidence guard後のunknownは提案も投稿もしない", async () => {
    const createIssueComment = vi.fn();
    const createIssue = vi.fn();
    const generate = vi.fn();
    const handler = createBuildEventHandler({
      configured: true,
      githubClient: {
        getWorkflowRunFailureLog: vi.fn(async () => "failed"),
        createIssueComment,
        createIssue,
      },
      auditLog: new InMemoryAuditLog(),
      classify: vi.fn(async () => ({
        classification: "unknown" as const,
        failed_job: "",
        failed_step: "",
        log_excerpt: "",
        confidence: 0.2,
      })),
      generate,
      repoCheckoutPathFor: () => "/repo",
    });

    await handler(workflowFailure, "trace-low");

    expect(generate).not.toHaveBeenCalled();
    expect(createIssueComment).not.toHaveBeenCalled();
    expect(createIssue).not.toHaveBeenCalled();
  });

  it("canonical PRが一意でなければrepository issueへ投稿し、API失敗は伝播する", async () => {
    const createIssue = vi.fn(async () => ({ number: 9, htmlUrl: "https://github.com/acme/widget/issues/9" }));
    const handler = createBuildEventHandler({
      configured: true,
      githubClient: {
        getWorkflowRunFailureLog: vi.fn(async () => "dependency resolution failed"),
        createIssueComment: vi.fn(),
        createIssue,
      },
      auditLog: new InMemoryAuditLog(),
      classify: vi.fn(async () => ({
        classification: "dependency" as const,
        failed_job: "build",
        failed_step: "install",
        log_excerpt: "resolution failed",
        confidence: 0.8,
      })),
      generate: vi.fn(async () => null),
      repoCheckoutPathFor: () => "/repo",
    });
    const noPrEvent = {
      ...workflowFailure,
      payload: {
        ...workflowFailure.payload,
        workflow_run: { ...workflowFailure.payload.workflow_run, pull_requests: [] },
      },
    };

    await handler(noPrEvent, "trace-issue");
    expect(createIssue).toHaveBeenCalledWith(expect.objectContaining({ owner: "acme", repo: "widget" }));

    createIssue.mockRejectedValueOnce(new Error("GitHub unavailable"));
    await expect(handler(noPrEvent, "trace-failure")).rejects.toThrow("GitHub unavailable");
  });

  it("LLMまたはGitHub未設定ではloud degraded監査だけ残す", async () => {
    const auditLog = new InMemoryAuditLog();
    const getWorkflowRunFailureLog = vi.fn();
    const classify = vi.fn();
    const handler = createBuildEventHandler({
      configured: false,
      disabledReason: "LLM is not configured",
      githubClient: {
        getWorkflowRunFailureLog,
        createIssueComment: vi.fn(),
        createIssue: vi.fn(),
      },
      auditLog,
      classify,
      generate: vi.fn(),
      repoCheckoutPathFor: () => "/repo",
    });

    await handler(workflowFailure, "trace-disabled");

    expect(getWorkflowRunFailureLog).not.toHaveBeenCalled();
    expect(classify).not.toHaveBeenCalled();
    expect((await auditLog.readAll()).map((record) => record.action)).toContain("build_triage_disabled");
  });

  it("pushとpull_requestは受信監査のみで分類しない", async () => {
    const classify = vi.fn();
    const handler = createBuildEventHandler({
      configured: true,
      githubClient: {
        getWorkflowRunFailureLog: vi.fn(),
        createIssueComment: vi.fn(),
        createIssue: vi.fn(),
      },
      auditLog: new InMemoryAuditLog(),
      classify,
      generate: vi.fn(),
      repoCheckoutPathFor: () => "/repo",
    });

    await handler({ ...workflowFailure, eventName: "push", payload: {} }, "trace-push");
    await handler({ ...workflowFailure, eventName: "pull_request", payload: {} }, "trace-pr");

    expect(classify).not.toHaveBeenCalled();
  });

  it("明示的なcheckout mappingが無ければ分類のみ行い修正案をdegraded監査する", async () => {
    const auditLog = new InMemoryAuditLog();
    const generate = vi.fn();
    const createIssueComment = vi.fn(async () => undefined);
    const handler = createBuildEventHandler({
      configured: true,
      githubClient: {
        getWorkflowRunFailureLog: vi.fn(async () => "test failed"),
        createIssueComment,
        createIssue: vi.fn(),
      },
      auditLog,
      classify: vi.fn(async () => ({
        classification: "test_failure" as const,
        failed_job: "test",
        failed_step: "vitest",
        log_excerpt: "failed",
        confidence: 0.9,
      })),
      generate,
      repoCheckoutPathFor: () => null,
    });

    await handler(workflowFailure, "trace-no-checkout");

    expect(generate).not.toHaveBeenCalled();
    expect(createIssueComment).toHaveBeenCalledOnce();
    expect((await auditLog.readAll()).map((record) => record.action)).toContain("build_fix_suggestion_disabled");
  });
});

describe("AGT_INC runtime wiring [DevOps:SPEC-INT-030 / DevOps:REQ-015]", () => {
  it("90日・最大5件のprovider seamを使い分類・通知し、将来のsimilarity用監査detailを残す", async () => {
    const now = new Date("2026-08-08T00:00:00.000Z");
    const readRecent = vi.fn(async () => [
      { at: "2026-08-07T00:00:00.000Z", detail: { severity: "sev2", alertDigest: "abc" } },
    ]);
    const provider = createRecencySimilarIncidentsProvider(readRecent, () => now);
    const auditLog = new InMemoryAuditLog();
    const classify = vi.fn(async () => ({
      severity_candidate: "sev2" as const,
      affected_projects: ["PRJ-1", fakeGitHubToken],
      rationale: `latency increased ${fakeGitHubToken}`,
    }));
    const triage = vi.fn(async (classification, _owner, _repo, _channel, deps) => {
      await deps.auditLog.append({
        trace_id: deps.traceId,
        actor: "AGT-INC",
        action: "triage",
        basis: "DevOps:REQ-015",
        detail: { effectiveSeverity: "sev2", issueUrl: "https://github.com/acme/widget/issues/1" },
        at: now.toISOString(),
      });
      return { issueUrl: "https://github.com/acme/widget/issues/1", effectiveSeverity: "sev2" };
    });
    const handler = createIncidentEventHandler({
      configured: true,
      channel: { teamId: "team", channelId: "channel" },
      metricsSnapshot: () => "aiops_events_queue_depth 3\n",
      similarIncidents: provider,
      findExistingIssue: vi.fn(async () => null),
      auditLog,
      classify,
      triage,
    });
    const alert = `API latency ${fakeGitHubToken}`;

    await handler(
      {
        targetAgent: "AGT_INC",
        eventName: "issues",
        payload: {
          action: "opened",
          repository: { full_name: "acme/widget" },
          issue: { number: 123, title: "Latency alert", body: alert, labels: [{ name: ALERT_LABEL }] },
        },
      },
      "trace-inc",
    );

    expect(readRecent).toHaveBeenCalledWith({ since: "2026-05-10T00:00:00.000Z", limit: 5 });
    expect(classify).toHaveBeenCalledWith(
      expect.stringContaining("Latency alert"),
      expect.stringContaining("queue"),
      expect.stringContaining("sev2"),
      expect.anything(),
    );
    expect(triage).toHaveBeenCalledOnce();
    expect(triage.mock.calls[0]![0].rationale).not.toContain(fakeGitHubToken);
    expect(triage.mock.calls[0]![4]).toMatchObject({ sourceIssueMarker: "source-issue:123", existingIssue: null });
    const triageRecord = (await auditLog.readAll()).find((record) => record.action === "triage")!;
    expect(triageRecord.detail).toMatchObject({
      severity: "sev2",
      affected_projects: ["PRJ-1", sanitizeSecrets(fakeGitHubToken).sanitized],
      alertDigest: createHash("sha256")
        .update(sanitizeSecrets(`Latency alert\n${alert}`).sanitized)
        .digest("hex"),
    });
  });

  it("auto-triaged labelの自己生成Issueとopened以外はLLMへ送らない", async () => {
    const classify = vi.fn();
    const handler = createIncidentEventHandler({
      configured: true,
      channel: { teamId: "team", channelId: "channel" },
      metricsSnapshot: () => "metrics",
      similarIncidents: { summarize: vi.fn(async () => "similar") },
      findExistingIssue: vi.fn(async () => null),
      auditLog: new InMemoryAuditLog(),
      classify,
      triage: vi.fn(),
    });
    const base = {
      targetAgent: "AGT_INC" as const,
      eventName: "issues",
      payload: {
        action: "opened",
        repository: { full_name: "acme/widget" },
        issue: { number: 123, title: "generated", body: "body", labels: [{ name: "auto-triaged" }] },
      },
    };

    await handler(base, "trace-loop");
    await handler(
      {
        ...base,
        payload: {
          ...base.payload,
          issue: { number: 124, title: "generated", body: "<!-- aiops-agent:AGT-BLD -->", labels: [] },
        },
      },
      "trace-build-loop",
    );
    await handler(
      {
        ...base,
        payload: {
          ...base.payload,
          issue: { number: 125, title: "ordinary feature request", body: "body", labels: [] },
        },
      },
      "trace-non-alert",
    );
    await handler({ ...base, payload: { ...base.payload, action: "edited" } }, "trace-edited");

    expect(classify).not.toHaveBeenCalled();
  });

  it("LLMまたは既定Teams channel未設定ではdegraded監査だけ残す", async () => {
    const auditLog = new InMemoryAuditLog();
    const classify = vi.fn();
    const handler = createIncidentEventHandler({
      configured: false,
      disabledReason: "Default Teams channel is not configured",
      metricsSnapshot: vi.fn(),
      similarIncidents: { summarize: vi.fn() },
      findExistingIssue: vi.fn(),
      auditLog,
      classify,
      triage: vi.fn(),
    });

    await handler(
      {
        targetAgent: "AGT_INC",
        eventName: "issues",
        payload: {
          action: "opened",
          repository: { full_name: "acme/widget" },
          issue: { number: 123, title: "alert", body: "body", labels: [{ name: ALERT_LABEL }] },
        },
      },
      "trace-inc-disabled",
    );

    expect(classify).not.toHaveBeenCalled();
    expect((await auditLog.readAll()).map((record) => record.action)).toContain("incident_triage_disabled");
  });

  it("既存marker Issueを再利用し、新規Issue本文にはdeterministic markerを追加する", async () => {
    const existing = { number: 99, htmlUrl: "https://github.com/acme/widget/issues/99" };
    const createIssue = vi.fn(async () => ({ number: 100, htmlUrl: "https://github.com/acme/widget/issues/100" }));
    const input = { owner: "acme", repo: "widget", title: "incident", body: "details", labels: ["auto-triaged"] };

    await expect(
      createIncidentIssueClient({ createIssue }, "source-issue:123", existing).createIssue(input),
    ).resolves.toEqual(existing);
    expect(createIssue).not.toHaveBeenCalled();

    await createIncidentIssueClient({ createIssue }, "source-issue:123", null).createIssue(input);
    expect(createIssue).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining("source-issue:123") }),
    );
  });
});
