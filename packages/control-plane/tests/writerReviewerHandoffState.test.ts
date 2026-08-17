/** 根拠: FinalArch:COD-001 / FinalArch:COD-002 / ADR-0027 / WBS P8-T07 */
import { describe, expect, it } from "vitest";

import {
  applyWriterReviewerTransition,
  createWriterAssignment,
  type WriterReviewerHandoff,
} from "../src/workflows/writerReviewerHandoffState.js";

const SHA = {
  base: "1".repeat(40),
  first: "2".repeat(40),
  second: "3".repeat(40),
  takeover: "4".repeat(40),
};

function assigned(): WriterReviewerHandoff {
  return createWriterAssignment({
    taskId: "P8-T07",
    writer: "codex-deep-dot",
    reviewer: "claude-deep-dot",
    actor: "codex-deep-dot",
    range: { baseSha: SHA.base, headSha: SHA.base },
  }).next;
}

function started(): WriterReviewerHandoff {
  return applyWriterReviewerTransition(assigned(), {
    kind: "start_work",
    actor: "codex-deep-dot",
    expectedVersion: 1,
    range: { baseSha: SHA.base, headSha: SHA.base },
  }).next;
}

function ready(): WriterReviewerHandoff {
  return applyWriterReviewerTransition(started(), {
    kind: "submit_for_review",
    actor: "codex-deep-dot",
    expectedVersion: 2,
    range: { baseSha: SHA.base, headSha: SHA.first },
  }).next;
}

describe("writer-reviewer handoff state [FinalArch:COD-001 / FinalArch:COD-002]", () => {
  it("permits only writer_assigned → in_progress → ready_for_review → approved", () => {
    const final = applyWriterReviewerTransition(ready(), {
      kind: "approve",
      actor: "claude-deep-dot",
      expectedVersion: 3,
      range: { baseSha: SHA.base, headSha: SHA.first },
    });

    expect(final.next).toMatchObject({
      state: "approved",
      version: 4,
      writer: "codex-deep-dot",
      reviewer: "claude-deep-dot",
      reviewRange: { baseSha: SHA.base, headSha: SHA.first },
    });
    expect(final.record).toMatchObject({
      event: "approve",
      fromState: "ready_for_review",
      toState: "approved",
      expectedVersion: 3,
      resultingVersion: 4,
      range: { baseSha: SHA.base, headSha: SHA.first },
    });
  });

  it("invalidates the old approval after rework and pins approval to the new exact head", () => {
    const rework = applyWriterReviewerTransition(ready(), {
      kind: "request_rework",
      actor: "claude-deep-dot",
      expectedVersion: 3,
      reason: "fix the CAS evidence",
      range: { baseSha: SHA.base, headSha: SHA.first },
    }).next;
    const resumed = applyWriterReviewerTransition(rework, {
      kind: "resume_rework",
      actor: "codex-deep-dot",
      expectedVersion: 4,
      range: { baseSha: SHA.first, headSha: SHA.first },
    }).next;
    const resubmitted = applyWriterReviewerTransition(resumed, {
      kind: "submit_for_review",
      actor: "codex-deep-dot",
      expectedVersion: 5,
      range: { baseSha: SHA.first, headSha: SHA.second },
    }).next;

    expect(() =>
      applyWriterReviewerTransition(resubmitted, {
        kind: "approve",
        actor: "claude-deep-dot",
        expectedVersion: 6,
        range: { baseSha: SHA.base, headSha: SHA.first },
      }),
    ).toThrow(/exact review range/u);
    expect(
      applyWriterReviewerTransition(resubmitted, {
        kind: "approve",
        actor: "claude-deep-dot",
        expectedVersion: 6,
        range: { baseSha: SHA.first, headSha: SHA.second },
      }).next.state,
    ).toBe("approved");
  });

  it("records explicit reviewer takeover and swaps the one-writer roles", () => {
    const takeover = applyWriterReviewerTransition(ready(), {
      kind: "reviewer_takeover",
      actor: "claude-deep-dot",
      expectedVersion: 3,
      oldWriter: "codex-deep-dot",
      newWriter: "claude-deep-dot",
      reason: "writer unavailable; owner reassigned the fix",
      range: { baseSha: SHA.first, headSha: SHA.takeover },
    });

    expect(takeover.next).toMatchObject({
      state: "in_progress",
      version: 4,
      writer: "claude-deep-dot",
      reviewer: "codex-deep-dot",
      range: { baseSha: SHA.first, headSha: SHA.takeover },
      reviewRange: null,
    });
    expect(takeover.record).toMatchObject({
      event: "reviewer_takeover",
      oldWriter: "codex-deep-dot",
      newWriter: "claude-deep-dot",
      reason: "writer unavailable; owner reassigned the fix",
    });
  });

  it.each([
    ["same writer/reviewer", () => createWriterAssignment({ ...assignedInput(), reviewer: "codex-deep-dot" })],
    [
      "malformed SHA",
      () => createWriterAssignment({ ...assignedInput(), range: { baseSha: "main", headSha: "main" } }),
    ],
    [
      "hidden pre-assignment commit",
      () => createWriterAssignment({ ...assignedInput(), range: { baseSha: SHA.base, headSha: SHA.first } }),
    ],
    ["wrong writer actor", () => applyWriterReviewerTransition(started(), submit({ actor: "claude-deep-dot" }))],
    ["stale version", () => applyWriterReviewerTransition(started(), submit({ expectedVersion: 1 }))],
    ["illegal transition", () => applyWriterReviewerTransition(assigned(), submit({ expectedVersion: 1 }))],
    [
      "empty rework reason",
      () =>
        applyWriterReviewerTransition(ready(), {
          kind: "request_rework",
          actor: "claude-deep-dot",
          expectedVersion: 3,
          reason: " ",
          range: { baseSha: SHA.base, headSha: SHA.first },
        }),
    ],
  ])("rejects %s", (_label, run) => {
    expect(run).toThrow();
  });

  it.each([
    {},
    { oldWriter: "codex-deep-dot" },
    { oldWriter: "codex-deep-dot", newWriter: "claude-deep-dot" },
    { oldWriter: "other-writer", newWriter: "claude-deep-dot", reason: "reassigned" },
    { oldWriter: "codex-deep-dot", newWriter: "other-reviewer", reason: "reassigned" },
    { oldWriter: "codex-deep-dot", newWriter: "claude-deep-dot", reason: " " },
  ])("rejects incomplete or contradictory takeover fields %#", (fields) => {
    expect(() =>
      applyWriterReviewerTransition(ready(), {
        kind: "reviewer_takeover",
        actor: "claude-deep-dot",
        expectedVersion: 3,
        range: { baseSha: SHA.first, headSha: SHA.takeover },
        ...fields,
      }),
    ).toThrow();
  });

  it("rejects an implicit writer change on an ordinary transition", () => {
    expect(() =>
      applyWriterReviewerTransition(started(), {
        ...submit(),
        newWriter: "claude-deep-dot",
      }),
    ).toThrow(/unexpected field/u);
  });
});

function assignedInput() {
  return {
    taskId: "P8-T07",
    writer: "codex-deep-dot",
    reviewer: "claude-deep-dot",
    actor: "codex-deep-dot",
    range: { baseSha: SHA.base, headSha: SHA.base },
  };
}

function submit(overrides: Record<string, unknown> = {}) {
  return {
    kind: "submit_for_review",
    actor: "codex-deep-dot",
    expectedVersion: 2,
    range: { baseSha: SHA.base, headSha: SHA.first },
    ...overrides,
  };
}
