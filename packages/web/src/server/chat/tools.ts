/**
 * packages/web/src/server/chat/tools.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード：チャットによる動的表示切替。capability-basedなtool露出）/
 *   ADR-0013 / REQ-041 / SPEC-INT-068 / AC-041-1。
 *   ペルソナに応じて「LLMのコンテキストに見せるtoolそのもの」を絞り込む。権限外のtoolは
 *   ToolSetに含めないため、LLMはそもそも権限外の表示を要求できない
 *   （CLAUDE.md設計原則6: 権限フィルタはデータ取得側で強制、表示層での後付けマスキングは禁止、
 *   と同じ思想をチャットのtool呼び出し面に適用したもの）。
 *
 *   - showExecutiveSummary: PRF-04（PrjOps経営陣）のみに公開。
 *   - showManagerSummary: PRF-03（PrjOpsマネージャー）/ PRF-G（DevOpsマネージャー）のみに公開。
 *   - showAgentActivity: PRF-G（DevOpsマネージャー）のみに公開（ADR-0006 4b:
 *     AIコーディングエージェント稼働可視化）。PRF-L公開は次フェーズ残課題
 *     （現状Web側にPRF-L向けのデータ層が無いため。agentActivityData.ts参照）。
 *   - listProjects: 全ペルソナ共通。
 *
 *   execute は zod による入力検証のみを行い、検証済みの ViewSpec を返す
 *   （実データ自体は返さない。CLAUDE.md設計原則2: LLMは表示パラメータ決定のみ）。
 *   実データの取得は ViewSpec を受け取った DashboardClient 側が既存の /api/data/* を呼び出して行う。
 */
import { z } from "zod";
import { tool, type ToolSet } from "ai";
import { isProjectInScope as isPrjopsProjectInScope } from "@aiops/prjops";
import type { ResolvedPersona } from "../personaResolver";
import { parseViewSpec, type ViewSpec } from "../viewSpec";

const showExecutiveSummaryInputSchema = z.object({}).strict();

const showManagerSummaryInputSchema = z
  .object({
    /** バーンダウン集計期間（日数）。未指定時は呼び出し側の既定値（28日）が使われる。 */
    periodDays: z.union([z.literal(7), z.literal(14), z.literal(28)]).optional(),
  })
  .strict();

const showTimeseriesInputSchema = z
  .object({
    period: z.enum(["week", "month", "quarter", "half", "year"]),
  })
  .strict();

const listProjectsInputSchema = z.object({}).strict();
const showProjectBoardInputSchema = z.object({ projectId: z.string() }).strict();

const showAgentActivityInputSchema = z.object({}).strict();
const showInvestorSummaryInputSchema = z.object({}).strict();

/** PRF-04（PrjOps経営陣）専用: セブンキーの表示要求 */
function buildShowExecutiveSummaryTool() {
  return tool({
    description:
      "経営層向けセブンキーサマリー（ポートフォリオ健康度・進捗達成率・高リスク課題件数・予算消化率・スケジュール遵守率等）の表示に切り替える。数値そのものはこのtoolでは返さず、本文中で数値を述べてはならない。",
    inputSchema: showExecutiveSummaryInputSchema,
    execute: async (): Promise<ViewSpec> => {
      return parseViewSpec({ kind: "executiveSummary" });
    },
  });
}

/** PRF-03（PrjOpsマネージャー）/ PRF-G（DevOpsマネージャー）専用: マネージャーサマリの表示要求 */
function buildShowManagerSummaryTool() {
  return tool({
    description:
      "マネージャー向けサマリー（総プロジェクト数・総チケット数・残チケット数・バーンダウン推移）の表示に切り替える。periodDaysでバーンダウンの集計期間（7/14/28日）を指定できる。数値そのものはこのtoolでは返さず、本文中で数値を述べてはならない。",
    inputSchema: showManagerSummaryInputSchema,
    execute: async (input): Promise<ViewSpec> => {
      const parsed = showManagerSummaryInputSchema.parse(input);
      return parseViewSpec({ kind: "managerSummary", periodDays: parsed.periodDays });
    },
  });
}

/** PRF-G（DevOpsマネージャー）専用: AIコーディングエージェント稼働状況の表示要求（ADR-0006 4b） */
function buildShowAgentActivityTool() {
  return tool({
    description:
      "AIコーディングエージェント（Claude Code / Droid）の稼働状況（タスクのステータス別件数・完了成功率・直近生成PR一覧）の表示に切り替える。数値そのものはこのtoolでは返さず、本文中で数値を述べてはならない。",
    inputSchema: showAgentActivityInputSchema,
    execute: async (): Promise<ViewSpec> => {
      return parseViewSpec({ kind: "agentActivity" });
    },
  });
}

function buildShowInvestorSummaryTool() {
  return tool({
    description:
      "投資家向けKPIパッケージ（ハイライト、KPI、マイルストーン、リスク）の表示に切り替える。数値そのものはこのtoolでは返さず、本文中で数値を述べてはならない。",
    inputSchema: showInvestorSummaryInputSchema,
    execute: async (): Promise<ViewSpec> => {
      return parseViewSpec({ kind: "investorSummary" });
    },
  });
}

function buildShowTimeseriesTool() {
  return tool({
    description:
      "現在ページの選択ペルソナ範囲で時系列スナップショットを表示する。periodでweek/month/quarter/half/yearを指定できる。数値そのものはこのtoolでは返さず、本文中で数値を述べてはならない。",
    inputSchema: showTimeseriesInputSchema,
    execute: async (input): Promise<ViewSpec> => {
      const parsed = showTimeseriesInputSchema.parse(input);
      return parseViewSpec({ kind: "timeseries", period: parsed.period });
    },
  });
}

/** 全ペルソナ共通: スコープ内プロジェクト一覧の表示要求 */
function buildListProjectsTool() {
  return tool({
    description: "スコープ内のプロジェクト一覧（ID・名称のみ）の表示に切り替える。",
    inputSchema: listProjectsInputSchema,
    execute: async (): Promise<ViewSpec> => {
      return parseViewSpec({ kind: "projectList" });
    },
  });
}

function isProjectInPersonaScope(persona: ResolvedPersona, projectId: string): boolean {
  if (persona.domain === "devops") {
    return persona.profile === "PRF-G" || persona.visibility.recipientAssignedProjectIds.includes(projectId);
  }
  return isPrjopsProjectInScope(persona.profile, projectId, persona.visibility);
}

function buildShowProjectBoardTool(persona: ResolvedPersona) {
  return tool({
    description:
      "現在の利用者スコープ内にある1件のプロジェクトについて、読み取り専用Kanban表示へ切り替える。projectIdはcanonical PJ-### IDに限る。カードや件数は返さない。",
    inputSchema: showProjectBoardInputSchema,
    execute: async (input): Promise<ViewSpec> => {
      const parsedInput = showProjectBoardInputSchema.parse(input);
      const spec = parseViewSpec({ kind: "projectBoard", projectId: parsedInput.projectId });
      if (!isProjectInPersonaScope(persona, parsedInput.projectId)) {
        throw new Error("projectId is out of scope");
      }
      return spec;
    },
  });
}

function isPrjopsExecutive(persona: ResolvedPersona): boolean {
  return persona.domain === "prjops" && persona.profile === "PRF-04";
}

function isManager(persona: ResolvedPersona): boolean {
  return (
    (persona.domain === "prjops" && persona.profile === "PRF-03") ||
    (persona.domain === "devops" && persona.profile === "PRF-G")
  );
}

function isDevopsManager(persona: ResolvedPersona): boolean {
  return persona.domain === "devops" && persona.profile === "PRF-G";
}

function isInvestor(persona: ResolvedPersona): boolean {
  return persona.domain === "investor" && persona.profile === "investor";
}

/**
 * ペルソナ（ダッシュボードページ本体と同じ「先頭ペルソナ採用」方針。dashboard/page.tsxの
 * 残課題コメント参照）に応じて公開するtool集合を組み立てる。該当しないtoolはToolSetに
 * 一切含めない（LLMのコンテキストにそもそも見せない）。
 */
export function buildToolsForPersona(persona: ResolvedPersona): ToolSet {
  const toolSet: ToolSet = {
    listProjects: buildListProjectsTool(),
    show_project_board: buildShowProjectBoardTool(persona),
    show_projects_table: buildListProjectsTool(),
    show_timeseries: buildShowTimeseriesTool(),
  };

  if (isPrjopsExecutive(persona)) {
    toolSet["showExecutiveSummary"] = buildShowExecutiveSummaryTool();
    toolSet["show_seven_keys"] = buildShowExecutiveSummaryTool();
  }
  if (isManager(persona)) {
    toolSet["showManagerSummary"] = buildShowManagerSummaryTool();
    toolSet["show_burndown"] = buildShowManagerSummaryTool();
    toolSet["show_dora"] = buildShowManagerSummaryTool();
  }
  if (isDevopsManager(persona)) {
    toolSet["showAgentActivity"] = buildShowAgentActivityTool();
  }
  if (isInvestor(persona)) {
    toolSet["showInvestorSummary"] = buildShowInvestorSummaryTool();
    toolSet["show_investor_kpis"] = buildShowInvestorSummaryTool();
  }

  return toolSet;
}
