/**
 * packages/shared/src/reporting/reportSchema.ts
 *
 * 根拠:
 *   - PrjOps REQ-040 / SPEC-INT-067 / AC-040-1: Claude Code と Droid の標準報告は同一形式・同一粒度・
 *     同一文量で生成し、根拠IDヘッダを必須にする。
 *   - DevOps SPEC-INT-082 / AC-032a: DevOps側の標準報告も同じ共通スキーマで検証する。
 *
 * JSON SchemaはClaude Code/Droidの入口とCI検証で共有する。maxCharsはstructured outputs側で
 * 強制できないため、x-maxCharsメタデータとして保持し、reportValidation.tsで決定的に検証する。
 */

export const STANDARD_REPORT_SCHEMA_VERSION = "standard-report.v1";

export const STANDARD_REPORT_SLOT_SPECS = [
  { key: "conclusion", title: "結論", maxChars: 180 },
  { key: "riskSummary", title: "リスク要約", maxChars: 160 },
  { key: "nextActions", title: "次アクション", maxChars: 160 },
] as const;

export type StandardReportSlotKey = (typeof STANDARD_REPORT_SLOT_SPECS)[number]["key"];
export type StandardReportSlots = Record<StandardReportSlotKey, string>;
export type StandardReportType = "weekly-summary" | "manager-weekly" | "investor-quarterly";

export interface StandardReportPayload {
  schemaVersion: typeof STANDARD_REPORT_SCHEMA_VERSION;
  reportType: StandardReportType;
  evidenceIds: string[];
  period: {
    label: string;
    generatedAt: string;
  };
  metrics: Record<string, number>;
  slots: StandardReportSlots;
}

export function standardReportSlotKeys(): StandardReportSlotKey[] {
  return STANDARD_REPORT_SLOT_SPECS.map((slot) => slot.key);
}

export function standardReportSlotMaxChars(key: StandardReportSlotKey): number {
  return STANDARD_REPORT_SLOT_SPECS.find((slot) => slot.key === key)?.maxChars ?? 0;
}

function slotProperties(): Record<StandardReportSlotKey, Record<string, unknown>> {
  const properties = {} as Record<StandardReportSlotKey, Record<string, unknown>>;
  for (const slot of STANDARD_REPORT_SLOT_SPECS) {
    properties[slot.key] = {
      type: "string",
      description: `${slot.title}。${slot.maxChars}文字以内。`,
      "x-maxChars": slot.maxChars,
    };
  }
  return properties;
}

export const STANDARD_REPORT_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://aiops.local/schemas/standard-report.v1.json",
  title: "AI Ops Standard Agent Report",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "reportType", "evidenceIds", "period", "metrics", "slots"],
  properties: {
    schemaVersion: { const: STANDARD_REPORT_SCHEMA_VERSION },
    reportType: { enum: ["weekly-summary", "manager-weekly", "investor-quarterly"] },
    evidenceIds: {
      type: "array",
      minItems: 1,
      items: { type: "string" },
      description: "報告の根拠IDヘッダ。REQ/SPEC/AC/trace_id等を最低1件含める。",
    },
    period: {
      type: "object",
      additionalProperties: false,
      required: ["label", "generatedAt"],
      properties: {
        label: { type: "string" },
        generatedAt: { type: "string" },
      },
    },
    metrics: {
      type: "object",
      additionalProperties: { type: "number" },
      description: "コード算出済みの数値。LLMはここを生成しない。",
    },
    slots: {
      type: "object",
      additionalProperties: false,
      required: standardReportSlotKeys(),
      properties: slotProperties(),
    },
  },
} as const;

export function createReportSlotsToolSchema(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: standardReportSlotKeys(),
    properties: slotProperties(),
  };
}
