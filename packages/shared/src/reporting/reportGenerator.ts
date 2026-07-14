/**
 * packages/shared/src/reporting/reportGenerator.ts
 *
 * 根拠: REQ-040 / SPEC-INT-067 / SPEC-INT-082。
 */
import type { AuditLogWriter } from "../auditLog.js";
import type { StructuredCallOptions, StructuredCallResult } from "../clients/anthropicClient.js";
import {
  createReportSlotsToolSchema,
  STANDARD_REPORT_SCHEMA_VERSION,
  type StandardReportMetric,
  type StandardReportPayload,
  type StandardReportSlots,
} from "./reportSchema.js";
import { buildWeeklySummaryPrompt, type WeeklySummaryPromptInput } from "./reportPrompt.js";
import { parseReportSlots, truncateReportSlots, validateStandardReportPayload } from "./reportValidation.js";

export interface ReportStructuredClient {
  call<T>(opts: StructuredCallOptions<T>): Promise<StructuredCallResult<T>>;
}

export interface GenerateReportSlotsOptions extends WeeklySummaryPromptInput {
  traceId: string;
  actor: string;
  client: ReportStructuredClient;
  auditLog?: AuditLogWriter;
}

export interface GenerateReportSlotsResult {
  slots: StandardReportSlots;
  attempts: number;
  truncatedKeys: string[];
}

export type StandardReportEvidenceBuildInput = Omit<WeeklySummaryPromptInput, "metrics"> & {
  metrics: Record<string, StandardReportMetric>;
};

function parseClientSlots(raw: unknown): { slots?: StandardReportSlots; errors: string[] } {
  try {
    return { slots: parseReportSlots(raw), errors: [] };
  } catch (error) {
    return { errors: [error instanceof Error ? error.message : String(error)] };
  }
}

async function appendAudit(
  auditLog: AuditLogWriter | undefined,
  traceId: string,
  actor: string,
  action: string,
  detail: Record<string, unknown>,
): Promise<void> {
  await auditLog?.append({
    trace_id: traceId,
    actor,
    action,
    basis: "REQ-040/SPEC-INT-067/SPEC-INT-082",
    detail,
    at: new Date().toISOString(),
  });
}

export async function generateReportSlots(opts: GenerateReportSlotsOptions): Promise<GenerateReportSlotsResult> {
  if (Object.values(opts.metrics).some((value) => !Number.isFinite(value))) {
    throw new Error("E-RPT05: report metrics must be finite code-calculated numbers");
  }
  const prompt = buildWeeklySummaryPrompt(opts);
  const callBase = {
    agent: opts.actor,
    purpose: "standard_report_slots",
    system: "Generate only the requested report slots. Do not invent metrics.",
    toolName: "emit_report_slots",
    toolDescription: "Emit standardized AI Ops report narrative slots.",
    inputSchema: createReportSlotsToolSchema(),
    parse: parseReportSlots,
    maxAttempts: 1,
  } satisfies Omit<StructuredCallOptions<StandardReportSlots>, "user">;

  const first = await opts.client.call<StandardReportSlots>({ ...callBase, user: prompt });
  const firstParsed = parseClientSlots(first.value);
  const firstValidation = firstParsed.slots
    ? validateStandardReportPayload(buildStandardReportPayload(opts, firstParsed.slots))
    : { ok: false, errors: firstParsed.errors };
  if (firstValidation.ok) return { slots: firstParsed.slots!, attempts: 1, truncatedKeys: [] };

  await appendAudit(opts.auditLog, opts.traceId, opts.actor, "report_slot_validation_retry", {
    errors: firstValidation.errors,
  });

  const retry = await opts.client.call<StandardReportSlots>({
    ...callBase,
    user: `${prompt}\n\n前回出力の問題: ${firstValidation.errors.join("; ")}。必ず文字数上限内に収める。`,
  });
  const retryParsed = parseClientSlots(retry.value);
  const retryValidation = retryParsed.slots
    ? validateStandardReportPayload(buildStandardReportPayload(opts, retryParsed.slots))
    : { ok: false, errors: retryParsed.errors };
  if (retryValidation.ok) return { slots: retryParsed.slots!, attempts: 2, truncatedKeys: [] };
  if (retryValidation.errors.some((error) => error.includes("ungrounded numeric value"))) {
    await appendAudit(opts.auditLog, opts.traceId, opts.actor, "report_slot_numeric_rejected", {
      errors: retryValidation.errors,
    });
    throw new Error(`E-RPT04: report slot contains ungrounded numeric value: ${retryValidation.errors.join("; ")}`);
  }

  if (!retryParsed.slots || retryValidation.errors.some((error) => !error.match(/^slots\.[^.]+ exceeds \d+ chars$/))) {
    throw new Error(`E-RPT01: invalid report slots: ${retryValidation.errors.join("; ")}`);
  }

  const truncated = truncateReportSlots(retryParsed.slots);
  const finalValidation = validateStandardReportPayload(buildStandardReportPayload(opts, truncated.slots));
  if (!finalValidation.ok) {
    throw new Error(`E-RPT02: invalid finalized report slots: ${finalValidation.errors.join("; ")}`);
  }
  await appendAudit(opts.auditLog, opts.traceId, opts.actor, "report_slot_truncated", {
    errors: retryValidation.errors,
    truncatedKeys: truncated.truncatedKeys,
  });
  return { slots: truncated.slots, attempts: 2, truncatedKeys: truncated.truncatedKeys };
}

export function buildStandardReportPayload(
  input: WeeklySummaryPromptInput,
  slots: StandardReportSlots,
  generatedAt = new Date().toISOString(),
): StandardReportPayload {
  return buildStandardReportPayloadFromMetrics(
    {
      ...input,
      metrics: Object.fromEntries(
        Object.entries(input.metrics).map(([key, value]) => [
          key,
          { value, source: `code:standard-report-generator:${key}`, as_of: generatedAt },
        ]),
      ),
    },
    slots,
    generatedAt,
  );
}

export function buildStandardReportPayloadFromMetrics(
  input: StandardReportEvidenceBuildInput,
  slots: StandardReportSlots,
  generatedAt = new Date().toISOString(),
): StandardReportPayload {
  return {
    schemaVersion: STANDARD_REPORT_SCHEMA_VERSION,
    reportType: input.reportType ?? "weekly-summary",
    evidenceIds: input.evidenceIds,
    period: { label: input.periodLabel, generatedAt },
    metrics: input.metrics,
    slots,
  };
}
