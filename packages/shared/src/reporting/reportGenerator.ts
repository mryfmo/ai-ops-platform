import type { AuditLogWriter } from "../auditLog.js";
import type { StructuredCallOptions, StructuredCallResult } from "../clients/anthropicClient.js";
import { createReportSlotsToolSchema, type StandardReportSlots } from "./reportSchema.js";
import { buildWeeklySummaryPrompt, type WeeklySummaryPromptInput } from "./reportPrompt.js";
import { parseReportSlots, truncateReportSlots, validateStandardReportPayload } from "./reportValidation.js";
import { STANDARD_REPORT_SCHEMA_VERSION, type StandardReportPayload } from "./reportSchema.js";

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
  const firstPayload = buildStandardReportPayload(opts, first.value);
  const firstValidation = validateStandardReportPayload(firstPayload);
  if (firstValidation.ok) return { slots: first.value, attempts: 1, truncatedKeys: [] };

  await appendAudit(opts.auditLog, opts.traceId, opts.actor, "report_slot_validation_retry", {
    errors: firstValidation.errors,
  });

  const retry = await opts.client.call<StandardReportSlots>({
    ...callBase,
    user: `${prompt}\n\n前回出力の問題: ${firstValidation.errors.join("; ")}。必ず文字数上限内に収める。`,
  });
  const retryPayload = buildStandardReportPayload(opts, retry.value);
  const retryValidation = validateStandardReportPayload(retryPayload);
  if (retryValidation.ok) return { slots: retry.value, attempts: 2, truncatedKeys: [] };

  const truncated = truncateReportSlots(retry.value);
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
  return {
    schemaVersion: STANDARD_REPORT_SCHEMA_VERSION,
    reportType: "weekly-summary",
    evidenceIds: input.evidenceIds,
    period: { label: input.periodLabel, generatedAt },
    metrics: input.metrics,
    slots,
  };
}
