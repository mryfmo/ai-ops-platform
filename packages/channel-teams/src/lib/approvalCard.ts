// 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-001 / FinalArch:FR-UI-006 / ADR-0025

export type ApprovalCardDecision = "approved" | "rejected";

export interface ApprovalCardActionData {
  readonly action: "approval_decision";
  readonly approvalId: string;
  readonly version: number;
  readonly decision: ApprovalCardDecision;
  readonly correlation: string;
}

export interface ApprovalAdaptiveCard {
  readonly $schema: "http://adaptivecards.io/schemas/adaptive-card.json";
  readonly type: "AdaptiveCard";
  readonly version: "1.5";
  readonly body: readonly [
    { readonly type: "TextBlock"; readonly text: string; readonly weight: "Bolder" },
    { readonly type: "TextBlock"; readonly text: string; readonly wrap: true },
    {
      readonly type: "Input.Text";
      readonly id: "reason";
      readonly isMultiline: true;
      readonly placeholder: "Reason (required when rejecting)";
    },
  ];
  readonly actions: readonly [ApprovalCardSubmitAction<"approved">, ApprovalCardSubmitAction<"rejected">];
}

interface ApprovalCardSubmitAction<TDecision extends ApprovalCardDecision> {
  readonly type: "Action.Submit";
  readonly title: TDecision extends "approved" ? "Approve" : "Reject";
  readonly style: TDecision extends "approved" ? "positive" : "destructive";
  readonly data: ApprovalCardActionData & { readonly decision: TDecision };
}

export interface BuildApprovalCardInput {
  readonly approvalId: string;
  readonly version: number;
  /** Server-issued HMAC correlation; the presentation package never owns the signing key. */
  readonly signedCorrelation: string;
  readonly title: string;
  readonly summary: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const SIGNED_CORRELATION = /^v1\.[0-9a-f]{64}$/u;

export function buildApprovalCard(input: BuildApprovalCardInput): ApprovalAdaptiveCard {
  if (!UUID.test(input.approvalId)) throw new TypeError("Invalid approvalId");
  if (!Number.isSafeInteger(input.version) || input.version < 1) throw new TypeError("Invalid approval version");
  if (!SIGNED_CORRELATION.test(input.signedCorrelation)) throw new TypeError("Invalid signed correlation");
  if (!input.title.trim()) throw new TypeError("Invalid approval title");
  if (!input.summary.trim()) throw new TypeError("Invalid approval summary");

  const data = {
    action: "approval_decision" as const,
    approvalId: input.approvalId,
    version: input.version,
    correlation: input.signedCorrelation,
  };
  return {
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    type: "AdaptiveCard",
    version: "1.5",
    body: [
      { type: "TextBlock", text: input.title, weight: "Bolder" },
      { type: "TextBlock", text: input.summary, wrap: true },
      {
        type: "Input.Text",
        id: "reason",
        isMultiline: true,
        placeholder: "Reason (required when rejecting)",
      },
    ],
    actions: [
      { type: "Action.Submit", title: "Approve", style: "positive", data: { ...data, decision: "approved" } },
      { type: "Action.Submit", title: "Reject", style: "destructive", data: { ...data, decision: "rejected" } },
    ],
  };
}
