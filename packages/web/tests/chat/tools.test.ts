/**
 * packages/web/tests/chat/tools.test.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード：チャットによる動的表示切替。capability-basedなtool露出）/
 *   ADR-0013 / REQ-041 / SPEC-INT-068 / AC-041-1。
 *   ペルソナごとに公開されるtool一覧が正しいこと（PRF-04にshowManagerSummaryが露出しない等）と、
 *   execute()のzod境界値（periodDaysが7/14/28以外は拒否）を検証する。
 *   ADR-0006 4b: showAgentActivityがPRF-G（DevOpsマネージャー）以外に露出しないことも検証する。
 */
import { describe, expect, it } from "vitest";
import type { ResolvedPersona } from "../../src/server/personaResolver";
import { buildToolsForPersona } from "../../src/server/chat/tools";

const prjopsExecutive: ResolvedPersona = {
  domain: "prjops",
  profile: "PRF-04",
  visibility: {
    recipientStakeholderId: "STK-EXEC",
    recipientManagedProjectIds: [],
    recipientAssignedProjectIds: [],
    recipientParticipatingProjectIds: [],
    investedProjectIds: [],
  },
};

const prjopsManager: ResolvedPersona = {
  domain: "prjops",
  profile: "PRF-03",
  visibility: {
    recipientStakeholderId: "STK-MGR",
    recipientManagedProjectIds: ["PJ-001"],
    recipientAssignedProjectIds: [],
    recipientParticipatingProjectIds: [],
    investedProjectIds: [],
  },
};

const prjopsMember: ResolvedPersona = {
  domain: "prjops",
  profile: "PRF-01",
  visibility: {
    recipientStakeholderId: "STK-MEM",
    recipientManagedProjectIds: [],
    recipientAssignedProjectIds: [],
    recipientParticipatingProjectIds: [],
    investedProjectIds: [],
  },
};

const devopsManager: ResolvedPersona = {
  domain: "devops",
  profile: "PRF-G",
  visibility: { recipientUserId: "U-G", recipientAssignedProjectIds: [] },
};

const devopsMember: ResolvedPersona = {
  domain: "devops",
  profile: "PRF-M",
  visibility: { recipientUserId: "U-M", recipientAssignedProjectIds: [] },
};

const investor: ResolvedPersona = {
  domain: "investor",
  profile: "investor",
  visibility: {
    recipientStakeholderId: "STK-INV",
    recipientManagedProjectIds: [],
    recipientAssignedProjectIds: [],
    recipientParticipatingProjectIds: [],
    investedProjectIds: ["PRJ-0001"],
  },
};

describe("buildToolsForPersona（ADR-0005: capability-basedなtool露出）", () => {
  it("PRF-04には経営向けtoolのみを公開する（showManagerSummaryは露出しない）", () => {
    const tools = buildToolsForPersona(prjopsExecutive);
    expect(Object.keys(tools).sort()).toEqual([
      "listProjects",
      "showExecutiveSummary",
      "show_project_board",
      "show_projects_table",
      "show_seven_keys",
      "show_timeseries",
    ]);
  });

  it("PRF-03（PrjOpsマネージャー）にはマネージャー向けtoolを公開する（showExecutiveSummaryは露出しない）", () => {
    const tools = buildToolsForPersona(prjopsManager);
    expect(Object.keys(tools).sort()).toEqual([
      "listProjects",
      "showManagerSummary",
      "show_burndown",
      "show_dora",
      "show_project_board",
      "show_projects_table",
      "show_timeseries",
    ]);
  });

  it("PRF-G（DevOpsマネージャー）にはshowManagerSummary・showAgentActivity・listProjectsを公開する", () => {
    const tools = buildToolsForPersona(devopsManager);
    expect(Object.keys(tools).sort()).toEqual([
      "listProjects",
      "showAgentActivity",
      "showManagerSummary",
      "show_burndown",
      "show_dora",
      "show_project_board",
      "show_projects_table",
      "show_timeseries",
    ]);
  });

  it("その他のペルソナ（PRF-01, PRF-M）には共通toolのみを公開する", () => {
    expect(Object.keys(buildToolsForPersona(prjopsMember)).sort()).toEqual([
      "listProjects",
      "show_project_board",
      "show_projects_table",
      "show_timeseries",
    ]);
    expect(Object.keys(buildToolsForPersona(devopsMember)).sort()).toEqual([
      "listProjects",
      "show_project_board",
      "show_projects_table",
      "show_timeseries",
    ]);
  });

  it("investorにはshowInvestorSummaryとlistProjectsを公開する [REQ-039]", () => {
    expect(Object.keys(buildToolsForPersona(investor)).sort()).toEqual([
      "listProjects",
      "showInvestorSummary",
      "show_investor_kpis",
      "show_project_board",
      "show_projects_table",
      "show_timeseries",
    ]);
  });

  it("PRF-03（PrjOpsマネージャー）にはshowAgentActivityを公開しない（DevOps専用）", () => {
    const tools = buildToolsForPersona(prjopsManager);
    expect(Object.keys(tools)).not.toContain("showAgentActivity");
  });

  it("PRF-04（PrjOps経営陣）にはshowAgentActivityを公開しない", () => {
    const tools = buildToolsForPersona(prjopsExecutive);
    expect(Object.keys(tools)).not.toContain("showAgentActivity");
  });
});

describe("showInvestorSummary tool（ADR-0011: investor専用）", () => {
  it("実行するとkind: investorSummaryのViewSpecを返す", async () => {
    const tools = buildToolsForPersona(investor);
    const result = await tools["showInvestorSummary"]!.execute!({}, { toolCallId: "t7", messages: [] });
    expect(result).toEqual({ kind: "investorSummary" });
  });
});

describe("page agent tools（ADR-0013: Reasoning UI + Generative UI）", () => {
  it("show_timeseriesはtimeseries ViewSpecを返す [REQ-041 / SPEC-INT-068 / AC-041-1]", async () => {
    const tools = buildToolsForPersona(prjopsExecutive);
    const result = await tools["show_timeseries"]!.execute!({ period: "week" }, { toolCallId: "t8", messages: [] });
    expect(result).toEqual({ kind: "timeseries", period: "week" });
  });

  it("show_doraとshow_burndownはマネージャーViewSpecを返す [AC-041-1]", async () => {
    const tools = buildToolsForPersona(devopsManager);
    await expect(tools["show_dora"]!.execute!({}, { toolCallId: "t9", messages: [] })).resolves.toEqual({
      kind: "managerSummary",
      periodDays: undefined,
    });
    await expect(
      tools["show_burndown"]!.execute!({ periodDays: 14 }, { toolCallId: "t10", messages: [] }),
    ).resolves.toEqual({
      kind: "managerSummary",
      periodDays: 14,
    });
  });
});

describe("showAgentActivity tool（ADR-0006 4b: PRF-G専用・検証済みViewSpecのみを返す）", () => {
  it("実行するとkind: agentActivityのViewSpecを返す（実データは含まない）", async () => {
    const tools = buildToolsForPersona(devopsManager);
    const result = await tools["showAgentActivity"]!.execute!({}, { toolCallId: "t6", messages: [] });
    expect(result).toEqual({ kind: "agentActivity" });
  });
});

describe("showExecutiveSummary tool（ADR-0005: 検証済みViewSpecのみを返す）", () => {
  it("実行するとkind: executiveSummaryのViewSpecを返す（実データは含まない）", async () => {
    const tools = buildToolsForPersona(prjopsExecutive);
    const result = await tools["showExecutiveSummary"]!.execute!({}, { toolCallId: "t1", messages: [] });
    expect(result).toEqual({ kind: "executiveSummary" });
  });
});

describe("showManagerSummary tool（ADR-0005: zod境界値検証）", () => {
  it("periodDays未指定時はperiodDays: undefinedのViewSpecを返す", async () => {
    const tools = buildToolsForPersona(prjopsManager);
    const result = await tools["showManagerSummary"]!.execute!({}, { toolCallId: "t2", messages: [] });
    expect(result).toEqual({ kind: "managerSummary", periodDays: undefined });
  });

  it.each([7, 14, 28] as const)("periodDays=%iは正当な値としてViewSpecに含まれる", async (periodDays) => {
    const tools = buildToolsForPersona(prjopsManager);
    const result = await tools["showManagerSummary"]!.execute!({ periodDays }, { toolCallId: "t3", messages: [] });
    expect(result).toEqual({ kind: "managerSummary", periodDays });
  });

  it("periodDaysが7/14/28以外の値のとき、zodスキーマがパースエラーを投げる", async () => {
    const tools = buildToolsForPersona(prjopsManager);
    await expect(
      tools["showManagerSummary"]!.execute!({ periodDays: 10 }, { toolCallId: "t4", messages: [] }),
    ).rejects.toThrow();
  });
});

describe("listProjects tool（ADR-0005: 全ペルソナ共通）", () => {
  it("実行するとkind: projectListのViewSpecを返す", async () => {
    const tools = buildToolsForPersona(prjopsMember);
    const result = await tools["listProjects"]!.execute!({}, { toolCallId: "t5", messages: [] });
    expect(result).toEqual({ kind: "projectList" });
  });
});

describe("show_project_board tool [PrjOps:REQ-041 / PrjOps:SPEC-INT-068]", () => {
  it("scope内のcanonical projectIdだけをprojectBoard ViewSpecとして返す", async () => {
    const tool = buildToolsForPersona(prjopsManager)["show_project_board"];
    expect(tool).toBeDefined();
    await expect(tool!.execute!({ projectId: "PJ-001" }, { toolCallId: "board-1", messages: [] })).resolves.toEqual({
      kind: "projectBoard",
      projectId: "PJ-001",
    });
  });

  it.each(["../foreign", "PRJ-0001", "all"])("malformed projectId %sをZod境界で拒否する", async (projectId) => {
    const tool = buildToolsForPersona(prjopsManager)["show_project_board"];
    expect(tool).toBeDefined();
    await expect(tool!.execute!({ projectId }, { toolCallId: "board-invalid", messages: [] })).rejects.toMatchObject({
      name: "ZodError",
    });
  });

  it("canonicalでもscope外のprojectIdを拒否する", async () => {
    const tool = buildToolsForPersona(prjopsManager)["show_project_board"];
    expect(tool).toBeDefined();
    const error = await tool!.execute!(
      { projectId: "PJ-999" },
      { toolCallId: "board-out-of-scope", messages: [] },
    ).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toMatchObject({ name: "ZodError" });
    expect(error).toMatchObject({ message: expect.stringMatching(/scope/i) });
  });
});

describe("show_timeseries period contract [PrjOps:REQ-041 / PrjOps:SPEC-INT-068]", () => {
  it.each(["week", "month", "quarter", "half", "year"] as const)("period=%sを受理する", async (period) => {
    const tool = buildToolsForPersona(prjopsManager)["show_timeseries"]!;
    await expect(tool.execute!({ period }, { toolCallId: `period-${period}`, messages: [] })).resolves.toEqual({
      kind: "timeseries",
      period,
    });
  });

  it("period欠落を拒否する", async () => {
    const tool = buildToolsForPersona(prjopsManager)["show_timeseries"]!;
    await expect(tool.execute!({}, { toolCallId: "period-missing", messages: [] })).rejects.toMatchObject({
      name: "ZodError",
    });
  });
});
