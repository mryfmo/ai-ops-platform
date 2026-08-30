// 根拠: ADR-0030 / JIRA-GH-GOV-001。Jira production composition の env gate と DI fail-close を検証する。
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { InMemoryAuditLog } from "@aiops/shared";
import { createJiraRuntimeComposition, type JiraEnvironmentMapping } from "../src/index.js";

const mapping: JiraEnvironmentMapping = {
  environment: "development",
  projects: {
    "PJ-001": {
      mapping_version: 1,
      jira_cloud_id: "11111111-1111-4111-8111-111111111111",
      jira_project_id: "10000",
      jira_project_key: "AICOE",
      allowed_status_ids: ["10001"],
      protected_status_ids: ["10001"],
      sprint_field_id: "customfield_10020",
    },
  },
};

const baseConfig = {
  JIRA_ENVIRONMENT_MAPPING_PATH: "/secure/jira.json",
  JIRA_WEBHOOK_BEARER_SECRET: "j".repeat(32),
  JIRA_MAPPING_OWNER_PUBLIC_KEY: undefined,
  JIRA_SITE_BASE_URL: undefined,
  JIRA_OAUTH_ACCESS_TOKEN: undefined,
};

function deps(overrides: Record<string, unknown> = {}) {
  return {
    auditLog: new InMemoryAuditLog(),
    enqueueJiraEvent: vi.fn(async () => true),
    traceIdProvider: () => "trace-jira",
    loadMapping: vi.fn(async () => mapping),
    ...overrides,
  };
}

describe("ADR-0030 Jira runtime composition", () => {
  it("keeps webhook and scheduler absent when Jira env is absent", async () => {
    const loadMapping = vi.fn(async () => mapping);
    const result = await createJiraRuntimeComposition(
      { ...baseConfig, JIRA_ENVIRONMENT_MAPPING_PATH: undefined, JIRA_WEBHOOK_BEARER_SECRET: undefined },
      deps({ loadMapping }),
    );
    expect(result).toEqual({});
    expect(loadMapping).not.toHaveBeenCalled();
  });

  it("fails startup when webhook env is configured without Temporal dispatch backend", async () => {
    await expect(createJiraRuntimeComposition(baseConfig, deps())).rejects.toThrow(/dispatchJiraEvent backend/);
  });

  it("wires validated mappings into webhook and event polling dispatch", async () => {
    const dispatchJiraEvent = vi.fn(async () => {});
    const result = await createJiraRuntimeComposition(baseConfig, deps({ dispatchJiraEvent }));
    expect(result.webhook?.authenticator.configured).toBe(true);
    await expect(result.webhook?.resolveProjectMapping("10000")).resolves.toMatchObject({ projectId: "PJ-001" });
    await result.dispatchJiraEvent?.({} as never, "trace-jira");
    expect(dispatchJiraEvent).toHaveBeenCalledTimes(1);
    expect(result.snapshotTask).toBeUndefined();
  });

  it("reads and validates the configured mapping before exposing webhook dependencies", async () => {
    const fixturePath = fileURLToPath(
      new URL("../../../docs/contracts/fixtures/jira-environment-mapping.dev.json", import.meta.url),
    );
    const result = await createJiraRuntimeComposition(
      { ...baseConfig, JIRA_ENVIRONMENT_MAPPING_PATH: fixturePath },
      deps({ dispatchJiraEvent: vi.fn(async () => {}), loadMapping: undefined }),
    );
    await expect(result.webhook?.resolveProjectMapping("10000")).resolves.toMatchObject({ projectId: "PJ-001" });
  });

  it("fails without snapshot commit backend and runs the injected backend without network", async () => {
    const snapshotConfig = {
      ...baseConfig,
      JIRA_SITE_BASE_URL: "https://company.atlassian.net",
      JIRA_OAUTH_ACCESS_TOKEN: "oauth-token",
    };
    const dispatchJiraEvent = vi.fn(async () => {});
    await expect(createJiraRuntimeComposition(snapshotConfig, deps({ dispatchJiraEvent }))).rejects.toThrow(
      /commitCompleteSnapshot backend/,
    );

    const commitCompleteSnapshot = vi.fn(async () => {});
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ issues: [], isLast: true }), { status: 200 }));
    const result = await createJiraRuntimeComposition(
      snapshotConfig,
      deps({ dispatchJiraEvent, commitCompleteSnapshot, fetchImpl }),
    );
    await result.snapshotTask?.run(new Date("2026-08-30T00:00:00Z"));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(commitCompleteSnapshot).toHaveBeenCalledTimes(1);
  });
});
