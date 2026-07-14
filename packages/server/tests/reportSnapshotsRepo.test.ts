import { describe, expect, it, vi } from "vitest";
import { buildAndDeliverManagerReport, resolveWeeklyDoraDeltas, type RptDependencies } from "@aiops/devops";
import { InMemoryAuditLog } from "@aiops/shared/auditLog.js";
import { DORA_WEEKLY_METRIC_CONTRACT } from "@aiops/shared/periodBuckets.js";
import { ReportSnapshotsRepo } from "../src/db/reportSnapshotsRepo.js";

const previousMetrics = {
  [DORA_WEEKLY_METRIC_CONTRACT.keys.deploymentFrequency]: 8,
  [DORA_WEEKLY_METRIC_CONTRACT.keys.leadTime]: 5,
  [DORA_WEEKLY_METRIC_CONTRACT.keys.changeFailureRate]: 10,
  [DORA_WEEKLY_METRIC_CONTRACT.keys.mttr]: 2,
};
const currentMetrics = {
  [DORA_WEEKLY_METRIC_CONTRACT.keys.deploymentFrequency]: 10,
  [DORA_WEEKLY_METRIC_CONTRACT.keys.leadTime]: 4,
  [DORA_WEEKLY_METRIC_CONTRACT.keys.changeFailureRate]: 8,
  [DORA_WEEKLY_METRIC_CONTRACT.keys.mttr]: 1.5,
};
const validWrite = {
  periodStart: "2026-07-06T00:00:00+09:00",
  periodEnd: "2026-07-13T00:00:00+09:00",
  scope: "global" as const,
  projectId: null,
  source: DORA_WEEKLY_METRIC_CONTRACT.source,
  metrics: currentMetrics,
  generatedAt: "2026-07-12T23:00:00+09:00",
};
const validRead = {
  projectId: null,
  scope: DORA_WEEKLY_METRIC_CONTRACT.scope,
  source: DORA_WEEKLY_METRIC_CONTRACT.source,
  keys: Object.values(DORA_WEEKLY_METRIC_CONTRACT.keys),
  after: "2026-06-29T00:00:00+09:00",
  before: "2026-07-13T00:00:00+09:00",
};

describe("ReportSnapshotsRepo [DevOps:REQ-031 / SPEC-INT-055 / SPEC-INT-081]", () => {
  it("canonical metric snapshotを有限値だけwriteする", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repo = new ReportSnapshotsRepo({ query });
    await repo.recordMetricSnapshot(validWrite);
    expect(query.mock.calls[0]![0]).toContain("INSERT INTO report_snapshots");
    expect(query.mock.calls[0]![1]).toEqual([
      "2026-07-06T00:00:00+09:00",
      "2026-07-13T00:00:00+09:00",
      DORA_WEEKLY_METRIC_CONTRACT.scope,
      null,
      DORA_WEEKLY_METRIC_CONTRACT.source,
      JSON.stringify(currentMetrics),
      "2026-07-12T23:00:00+09:00",
    ]);
    await expect(
      repo.recordMetricSnapshot({
        periodStart: "2026-07-06T00:00:00+09:00",
        periodEnd: "2026-07-13T00:00:00+09:00",
        scope: "global",
        projectId: null,
        source: DORA_WEEKLY_METRIC_CONTRACT.source,
        metrics: { invalid: Number.POSITIVE_INFINITY },
        generatedAt: "2026-07-12T23:00:00+09:00",
      }),
    ).rejects.toThrow(/finite/);
  });

  it.each([
    ["empty source", { source: "" }],
    ["untrimmed source", { source: " code:dora-summary " }],
    ["empty metrics", { metrics: {} }],
    ["untrimmed metric key", { metrics: { " bad ": 1 } }],
    ["date-only periodStart", { periodStart: "2026-07-06" }],
    ["timezone-less periodEnd", { periodEnd: "2026-07-13T00:00:00" }],
    ["impossible generatedAt", { generatedAt: "2026-02-30T00:00:00+09:00" }],
    ["invalid offset", { periodStart: "2026-07-06T00:00:00+14:01" }],
    ["unordered period", { periodStart: "2026-07-13T00:00:00+09:00" }],
    ["invalid scope", { scope: "portfolio" as "global" }],
    ["global project", { projectId: "PJ-001" }],
    ["project without id", { scope: "project", projectId: null }],
  ] as const)("不正なsnapshot identityをwriteしない: %s", async (_label, override) => {
    const query = vi.fn();
    const repo = new ReportSnapshotsRepo({ query });
    await expect(
      repo.recordMetricSnapshot({
        ...validWrite,
        ...override,
        scope: (override.scope ?? validWrite.scope) as "global" | "project",
      }),
    ).rejects.toThrow(/report snapshot/);
    expect(query).not.toHaveBeenCalled();
  });

  it("exact project/scope/source/keyと[after,before)でreadする", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          project_id: null,
          scope: DORA_WEEKLY_METRIC_CONTRACT.scope,
          source: DORA_WEEKLY_METRIC_CONTRACT.source,
          metrics: currentMetrics,
          period_start: "2026-07-06T00:00:00+09:00",
          generated_at: "2026-07-12T23:00:00+09:00",
        },
      ],
    });
    const repo = new ReportSnapshotsRepo({ query });
    const input = validRead;
    const observations = await repo.listWeeklyMetricObservations(input);
    expect(observations).toHaveLength(4);
    expect(observations[0]).toMatchObject({
      scope: DORA_WEEKLY_METRIC_CONTRACT.scope,
      source: DORA_WEEKLY_METRIC_CONTRACT.source,
      key: DORA_WEEKLY_METRIC_CONTRACT.keys.deploymentFrequency,
      value: 10,
      observedAt: "2026-07-06T00:00:00+09:00",
      asOf: "2026-07-12T23:00:00+09:00",
    });
    expect(query.mock.calls[0]![0]).toMatch(/project_id IS NOT DISTINCT FROM \$1/);
    expect(query.mock.calls[0]![0]).not.toMatch(/metrics \?\|/);
    expect(query.mock.calls[0]![0]).toMatch(/period_start >= \$4/);
    expect(query.mock.calls[0]![0]).toMatch(/period_start < \$5/);
    expect(query.mock.calls[0]![1]).toEqual([
      null,
      DORA_WEEKLY_METRIC_CONTRACT.scope,
      DORA_WEEKLY_METRIC_CONTRACT.source,
      input.after,
      input.before,
    ]);
  });

  it.each([
    ["invalid scope", { scope: "portfolio" }],
    ["global project", { projectId: "PJ-001" }],
    ["project missing id", { scope: "project", projectId: null }],
    ["project empty id", { scope: "project", projectId: "" }],
    ["project untrimmed id", { scope: "project", projectId: " PJ-001 " }],
    ["empty source", { source: "" }],
    ["untrimmed source", { source: " code:dora-summary " }],
    ["empty keys", { keys: [] }],
    ["empty key", { keys: [""] }],
    ["untrimmed key", { keys: [" metric "] }],
    ["duplicate keys", { keys: ["metric", "metric"] }],
    ["date-only after", { after: "2026-06-29" }],
    ["timezone-less before", { before: "2026-07-13T00:00:00" }],
    ["impossible after", { after: "2026-02-30T00:00:00+09:00" }],
    ["invalid before offset", { before: "2026-07-13T00:00:00+14:01" }],
    ["unordered bounds", { after: "2026-07-13T00:00:00+09:00" }],
  ] as const)("不正なread identityではDBを呼ばない: %s", async (_label, override) => {
    const query = vi.fn();
    const repo = new ReportSnapshotsRepo({ query });
    await expect(repo.listWeeklyMetricObservations({ ...validRead, ...override })).rejects.toThrow(/read/i);
    expect(query).not.toHaveBeenCalled();
  });

  it.each([
    ["malformed JSON", "{"],
    ["array JSON", []],
    ["scalar JSON", 42],
    ["requested key is nonnumeric", { [DORA_WEEKLY_METRIC_CONTRACT.keys.deploymentFrequency]: "10" }],
  ])("stored metrics異常はrepo→AGTでsource_error: %s", async (_label, metrics) => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          project_id: null,
          scope: DORA_WEEKLY_METRIC_CONTRACT.scope,
          source: DORA_WEEKLY_METRIC_CONTRACT.source,
          metrics,
          period_start: "2026-07-06T00:00:00+09:00",
          generated_at: "2026-07-12T23:00:00+09:00",
        },
      ],
    });
    const repo = new ReportSnapshotsRepo({ query });
    const result = await resolveWeeklyDoraDeltas("2026-07-09", {
      graphClient: { sendMail: async () => {} },
      auditLog: new InMemoryAuditLog(),
      traceId: "trace-invalid-stored-metric",
      fromMailbox: "devops@example.com",
      weeklyMetricReader: repo,
    });
    expect(result.deploymentFrequency).toMatchObject({ value: null, unavailable_reason: "source_error" });
  });

  it("requested key欠落はrepo→AGTでmissing_currentとなりsource_errorと区別する", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          project_id: null,
          scope: DORA_WEEKLY_METRIC_CONTRACT.scope,
          source: DORA_WEEKLY_METRIC_CONTRACT.source,
          metrics: { other_metric: 1 },
          period_start: "2026-07-06T00:00:00+09:00",
          generated_at: "2026-07-12T23:00:00+09:00",
        },
      ],
    });
    const repo = new ReportSnapshotsRepo({ query });
    const result = await resolveWeeklyDoraDeltas("2026-07-09", {
      graphClient: { sendMail: async () => {} },
      auditLog: new InMemoryAuditLog(),
      traceId: "trace-missing-stored-metric",
      fromMailbox: "devops@example.com",
      weeklyMetricReader: repo,
    });
    expect(result.deploymentFrequency).toMatchObject({ value: null, unavailable_reason: "missing_current" });
  });

  it("real repo adapterをAGT_RPTへDIして前週差分を配信する", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          project_id: null,
          scope: DORA_WEEKLY_METRIC_CONTRACT.scope,
          source: DORA_WEEKLY_METRIC_CONTRACT.source,
          metrics: previousMetrics,
          period_start: "2026-06-29T00:00:00+09:00",
          generated_at: "2026-07-05T23:00:00+09:00",
        },
        {
          project_id: null,
          scope: DORA_WEEKLY_METRIC_CONTRACT.scope,
          source: DORA_WEEKLY_METRIC_CONTRACT.source,
          metrics: currentMetrics,
          period_start: "2026-07-06T00:00:00+09:00",
          generated_at: "2026-07-12T23:00:00+09:00",
        },
      ],
    });
    const repo = new ReportSnapshotsRepo({ query });
    let html = "";
    const deps: RptDependencies = {
      graphClient: {
        sendMail: async (input) => {
          html = input.htmlBody;
        },
      },
      auditLog: new InMemoryAuditLog(),
      traceId: "trace-report-snapshot-integration",
      fromMailbox: "devops@example.com",
      weeklyMetricReader: repo,
    };
    await buildAndDeliverManagerReport(
      {
        periodLabel: "2026-W28",
        generatedAtLabel: "2026-07-12 23:00 JST",
        contactLine: "support@example.com",
        dateJst: "2026-07-09",
      },
      [],
      [],
      7,
      [],
      [],
      0,
      "週次",
      "U-030",
      "manager@example.com",
      deps,
    );
    expect(html).toContain('data-src="portfolio#deploy_freq_delta">2</span>');
    expect(html).toContain('data-src="portfolio#lead_time_delta">-1</span>');
  });
});
