/**
 * packages/web/src/server/viewSpec.ts
 *
 * 根拠: ADR-0005 / ADR-0013 / PrjOps:REQ-041 / PrjOps:SPEC-INT-068 / PrjOps:AC-041-1。
 * LLMが選べる表示宣言をstrict runtime schemaで固定し、実データ・数値・URL・HTMLの混入を拒否する。
 */
import { z } from "zod";

const emptyView = <T extends string>(kind: T) => z.object({ kind: z.literal(kind) }).strict();
const canonicalProjectId = /^PJ-\d{3,}$/;

export const viewSpecSchema = z.discriminatedUnion("kind", [
  emptyView("executiveSummary"),
  z
    .object({
      kind: z.literal("managerSummary"),
      periodDays: z.union([z.literal(7), z.literal(14), z.literal(28)]).optional(),
    })
    .strict(),
  emptyView("investorSummary"),
  emptyView("projectList"),
  z
    .object({
      kind: z.literal("timeseries"),
      period: z.enum(["week", "month", "quarter", "half", "year"]),
    })
    .strict(),
  emptyView("agentActivity"),
  z
    .object({
      kind: z.literal("projectBoard"),
      projectId: z.string().regex(canonicalProjectId, "canonical PJ-<at least 3 digits> projectId is required"),
    })
    .strict(),
]);

export type ViewSpec = z.infer<typeof viewSpecSchema>;
export type ManagerSummaryPeriodDays = 7 | 14 | 28;

export function parseViewSpec(value: unknown): ViewSpec {
  return viewSpecSchema.parse(value);
}

export function safeParseViewSpec(value: unknown): ReturnType<typeof viewSpecSchema.safeParse> {
  return viewSpecSchema.safeParse(value);
}
