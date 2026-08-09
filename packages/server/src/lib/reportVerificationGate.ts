/**
 * packages/server/src/lib/reportVerificationGate.ts
 *
 * 根拠: PrjOps:REQ-019 / PrjOps:SPEC-INT-051 / PrjOps:AC-019-1。
 */
import {
  buildForbiddenTermsForProfile,
  escapeHtml,
  isProjectInScope,
  verifyReportBeforeDelivery,
  type ReportAudience,
  type VerificationFailureCode,
} from "@aiops/prjops";
import { findUngroundedSlotNumbers, isValidId, type StandardReportPayload } from "@aiops/shared";
import { metricDisplayDefinition, metricKeyForPublicId } from "@aiops/shared/reporting/metricDisplayNames.js";

const ERROR_CODE_BY_FAILURE = {
  "V-A": "E-VER0A",
  "V-B": "E-VER0B",
  "V-C": "E-VER0C",
  "V-D": "E-VER0D",
} as const satisfies Record<VerificationFailureCode, string>;

export type ReportVerificationErrorCode = (typeof ERROR_CODE_BY_FAILURE)[VerificationFailureCode];

export function reportMetricDisplayValue(value: number | null): string {
  return value === null ? "N/A" : String(value);
}

export interface ReportRecipientVisibilityContext {
  recipientStakeholderId: string;
  projectIds: string[];
  scopeMode: "project" | "global";
  projectDomain: "prjops" | "devops";
}

export function filterReportContentForRecipient(
  payload: StandardReportPayload,
  audience: ReportAudience | null,
  recipient: ReportRecipientVisibilityContext,
): {
  visibleMetricEntries: Array<[string, StandardReportPayload["metrics"][string]]>;
  safeSlots: StandardReportPayload["slots"];
} {
  const context = {
    recipientStakeholderId: recipient.recipientStakeholderId,
    recipientManagedProjectIds: recipient.projectIds,
    recipientAssignedProjectIds: recipient.projectIds,
    recipientParticipatingProjectIds: recipient.projectIds,
    investedProjectIds: recipient.projectIds,
    scopeMode: recipient.scopeMode,
  };
  const visibleMetricEntries =
    audience === null
      ? []
      : Object.entries(payload.metrics)
          .filter(([key, metric]) => {
            if (!metricDisplayDefinition(key) || !metric.scope) return false;
            const projectIds = metric.scope.kind === "project" ? [metric.scope.projectId] : metric.scope.projectIds;
            const projectKind = recipient.projectDomain === "prjops" ? "project" : "projectDevOps";
            if (!projectIds.every((projectId) => isValidId(projectKind, projectId))) return false;
            return projectIds.every((projectId) => isProjectInScope(audience, projectId, context));
          })
          .map(([key, metric]) => [key, { ...metric }] as [string, typeof metric]);

  const hasHiddenMetric = visibleMetricEntries.length !== Object.keys(payload.metrics).length;
  const visibleValues = Object.fromEntries(
    visibleMetricEntries.flatMap(([key, metric]) => (typeof metric.value === "number" ? [[key, metric.value]] : [])),
  );
  const unsafeSlots = hasHiddenMetric
    ? new Set(Object.keys(payload.slots))
    : new Set(
        findUngroundedSlotNumbers(payload.slots, visibleValues, [payload.period.label]).map((finding) => finding.slot),
      );
  const safeSlots = Object.fromEntries(
    Object.entries(payload.slots).map(([key, value]) => [key, unsafeSlots.has(key) ? "[masked]" : value]),
  ) as StandardReportPayload["slots"];
  return { visibleMetricEntries, safeSlots };
}

export function evaluateReportVerificationGate(input: {
  payload: StandardReportPayload;
  html: string;
  audience: ReportAudience;
  personalNames: readonly string[];
  internalTerms: readonly string[];
  intendedRecipientEmail: string;
  actualToEmail: string;
}): ReturnType<typeof verifyReportBeforeDelivery> & { errorCodes: ReportVerificationErrorCode[] } {
  const result = verifyReportBeforeDelivery({
    html: input.html,
    numericLookup(path, field) {
      const key = metricKeyForPublicId(path);
      const metric = key ? (input.payload.metrics[key] as Record<string, unknown> | undefined) : undefined;
      const value = metric?.[field];
      if (value === undefined) return undefined;
      return value === null ? "N/A" : String(value);
    },
    forbiddenTerms: buildForbiddenTermsForProfile(
      input.audience,
      [...input.personalNames].map(escapeHtml),
      [...input.internalTerms].map(escapeHtml),
    ),
    intendedRecipientEmail: input.intendedRecipientEmail,
    actualToEmail: input.actualToEmail,
  });
  return { ...result, errorCodes: result.failureCodes.map((code) => ERROR_CODE_BY_FAILURE[code]) };
}
