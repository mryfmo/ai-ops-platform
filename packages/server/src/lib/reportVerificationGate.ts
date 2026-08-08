/**
 * packages/server/src/lib/reportVerificationGate.ts
 *
 * 根拠: PrjOps:REQ-019 / PrjOps:SPEC-INT-051 / PrjOps:AC-019-1。
 */
import {
  buildForbiddenTermsForProfile,
  escapeHtml,
  verifyReportBeforeDelivery,
  type ReportAudience,
  type VerificationFailureCode,
} from "@aiops/prjops";
import type { StandardReportPayload } from "@aiops/shared";

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
      const metric = input.payload.metrics[path] as Record<string, unknown> | undefined;
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
