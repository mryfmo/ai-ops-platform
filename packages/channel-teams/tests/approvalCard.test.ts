// 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-001 / FinalArch:FR-UI-006 / ADR-0025
import { describe, expect, it } from "vitest";

import { buildApprovalCard } from "../src/index.js";

const APPROVAL_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CORRELATION = `v1.${"a".repeat(64)}`;

describe("FinalArch:FR-UI-006 versioned approval card", () => {
  it("builds approve/reject actions bound to approval ID, version, and signed correlation", () => {
    const card = buildApprovalCard({
      approvalId: APPROVAL_ID,
      version: 7,
      signedCorrelation: CORRELATION,
      title: "Production deployment",
      summary: "Deploy release 42",
    });

    expect(card).toMatchObject({
      type: "AdaptiveCard",
      version: "1.5",
      body: [
        { type: "TextBlock", text: "Production deployment", weight: "Bolder" },
        { type: "TextBlock", text: "Deploy release 42", wrap: true },
        { type: "Input.Text", id: "reason", isMultiline: true },
      ],
    });
    expect(card.actions).toEqual([
      {
        type: "Action.Submit",
        title: "Approve",
        style: "positive",
        data: {
          action: "approval_decision",
          approvalId: APPROVAL_ID,
          version: 7,
          decision: "approved",
          correlation: CORRELATION,
        },
      },
      {
        type: "Action.Submit",
        title: "Reject",
        style: "destructive",
        data: {
          action: "approval_decision",
          approvalId: APPROVAL_ID,
          version: 7,
          decision: "rejected",
          correlation: CORRELATION,
        },
      },
    ]);
  });

  it.each([
    [{ approvalId: "not-a-uuid", version: 1, signedCorrelation: CORRELATION }, "approvalId"],
    [{ approvalId: APPROVAL_ID, version: 0, signedCorrelation: CORRELATION }, "version"],
    [{ approvalId: APPROVAL_ID, version: 1, signedCorrelation: "unsigned" }, "correlation"],
    [{ approvalId: APPROVAL_ID, version: 1, signedCorrelation: CORRELATION, title: " " }, "title"],
  ])("rejects invalid card contract input: %s", (input, expected) => {
    expect(() => buildApprovalCard(input)).toThrow(expected);
  });
});
