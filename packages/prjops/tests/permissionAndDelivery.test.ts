import { describe, it, expect } from "vitest";
import { evaluateApprovalTimer } from "../src/lib/approvalTimer.js";
import { InMemoryDeliveryLogStore, decideDelivery } from "../src/lib/idempotentDelivery.js";
import {
  isProjectInScope,
  canShowPersonalNames,
  canShowIssueDetail,
  filterIssuesForProfile,
  buildForbiddenTermsForProfile,
  type ProjectVisibilityContext,
} from "../src/lib/reportPermissionFilter.js";

describe("evaluateApprovalTimer [REQ-017 AC-017-2]", () => {
  const requestedAt = "2026-07-01T09:00:00+09:00";

  it("23時間経過ではまだ何もしない", () => {
    const now = new Date(Date.parse(requestedAt) + 23 * 60 * 60 * 1000);
    const r = evaluateApprovalTimer({
      requestedAt,
      now,
      alreadyEscalatedToProxy: false,
      alreadyNotifiedDelay: false,
      decided: false,
    });
    expect(r.action).toBe("none");
  });

  it("24時間経過で代理承認者へエスカレーション", () => {
    const now = new Date(Date.parse(requestedAt) + 24 * 60 * 60 * 1000);
    const r = evaluateApprovalTimer({
      requestedAt,
      now,
      alreadyEscalatedToProxy: false,
      alreadyNotifiedDelay: false,
      decided: false,
    });
    expect(r.action).toBe("escalate_to_proxy");
  });

  it("すでにエスカレーション済みなら24h超過でも重複実行しない", () => {
    const now = new Date(Date.parse(requestedAt) + 30 * 60 * 60 * 1000);
    const r = evaluateApprovalTimer({
      requestedAt,
      now,
      alreadyEscalatedToProxy: true,
      alreadyNotifiedDelay: false,
      decided: false,
    });
    expect(r.action).toBe("none");
  });

  it("48時間経過で配信保留のまま遅延通知", () => {
    const now = new Date(Date.parse(requestedAt) + 48 * 60 * 60 * 1000);
    const r = evaluateApprovalTimer({
      requestedAt,
      now,
      alreadyEscalatedToProxy: true,
      alreadyNotifiedDelay: false,
      decided: false,
    });
    expect(r.action).toBe("notify_delay_hold");
  });

  it("すでに承認/差し戻し済みなら何もしない", () => {
    const now = new Date(Date.parse(requestedAt) + 100 * 60 * 60 * 1000);
    const r = evaluateApprovalTimer({
      requestedAt,
      now,
      alreadyEscalatedToProxy: true,
      alreadyNotifiedDelay: true,
      decided: true,
    });
    expect(r.action).toBe("none");
  });
});

describe("decideDelivery [SPEC-INT-052, REQ-018 AC-018-2]", () => {
  it("未配信ならshouldSend=true、件名接尾辞なし", async () => {
    const store = new InMemoryDeliveryLogStore();
    const r = await decideDelivery(store, "RPT-001", "ST-010", false);
    expect(r.shouldSend).toBe(true);
    expect(r.subjectSuffix).toBe("");
  });

  it("配信済みかつ再送要求でなければスキップ（重複配信防止）", async () => {
    const store = new InMemoryDeliveryLogStore();
    await store.record({ reportId: "RPT-001", recipientId: "ST-010", deliveredAt: "2026-07-06T08:00:00+09:00" });
    const r = await decideDelivery(store, "RPT-001", "ST-010", false);
    expect(r.shouldSend).toBe(false);
  });

  it("配信済みだが再送要求の場合は(再送)を付けて送信する", async () => {
    const store = new InMemoryDeliveryLogStore();
    await store.record({ reportId: "RPT-001", recipientId: "ST-010", deliveredAt: "2026-07-06T08:00:00+09:00" });
    const r = await decideDelivery(store, "RPT-001", "ST-010", true);
    expect(r.shouldSend).toBe(true);
    expect(r.subjectSuffix).toBe("(再送)");
  });

  it("別の受信者には独立して配信できる", async () => {
    const store = new InMemoryDeliveryLogStore();
    await store.record({ reportId: "RPT-001", recipientId: "ST-010", deliveredAt: "x" });
    const r = await decideDelivery(store, "RPT-001", "ST-020", false);
    expect(r.shouldSend).toBe(true);
  });
});

describe("reportPermissionFilter [DOC-03 §4.5, SPEC-INT-051(b)]", () => {
  const ctx: ProjectVisibilityContext = {
    recipientStakeholderId: "ST-010",
    recipientManagedProjectIds: ["PJ-001", "PJ-002"],
    recipientAssignedProjectIds: ["PJ-001"],
    recipientParticipatingProjectIds: ["PJ-001"],
    investedProjectIds: ["PJ-002"],
  };

  it("PRF-01は参加プロジェクトのみ対象範囲", () => {
    expect(isProjectInScope("PRF-01", "PJ-001", ctx)).toBe(true);
    expect(isProjectInScope("PRF-01", "PJ-002", ctx)).toBe(false);
  });
  it("PRF-04は全プロジェクトが対象範囲", () => {
    expect(isProjectInScope("PRF-04", "PJ-999", ctx)).toBe(true);
  });
  it("PRF-05は出資対象プロジェクトのみ", () => {
    expect(isProjectInScope("PRF-05", "PJ-001", ctx)).toBe(false);
    expect(isProjectInScope("PRF-05", "PJ-002", ctx)).toBe(true);
  });
  it("investorはPRF-05と同じく出資対象プロジェクトのみ [REQ-039, SPEC-INT-066]", () => {
    expect(isProjectInScope("investor", "PJ-001", ctx)).toBe(false);
    expect(isProjectInScope("investor", "PJ-002", ctx)).toBe(true);
  });

  it("個人名表示可否: PRF-01〜03はtrue、PRF-04/05はfalse", () => {
    expect(canShowPersonalNames("PRF-02")).toBe(true);
    expect(canShowPersonalNames("PRF-04")).toBe(false);
    expect(canShowPersonalNames("PRF-05")).toBe(false);
  });

  it("課題詳細表示可否: PRF-05のみfalse", () => {
    expect(canShowIssueDetail("PRF-04")).toBe(true);
    expect(canShowIssueDetail("PRF-05")).toBe(false);
  });

  it("filterIssuesForProfile: PRF-01は自分の課題のみ", () => {
    const issues = [
      { projectId: "PJ-001", ownerStakeholderId: "ST-010", detail: "自分の課題" },
      { projectId: "PJ-001", ownerStakeholderId: "ST-999", detail: "他者の課題" },
    ];
    const filtered = filterIssuesForProfile("PRF-01", issues, ctx);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.detail).toBe("自分の課題");
  });

  it("filterIssuesForProfile: PRF-05はdetailを空にする", () => {
    const issues = [{ projectId: "PJ-002", detail: "機密の詳細", reportedByName: "田中太郎" }];
    const filtered = filterIssuesForProfile("PRF-05", issues, ctx);
    expect(filtered[0]?.detail).toBe("");
    expect(filtered[0]?.reportedByName).toBeUndefined();
  });
  it("filterIssuesForProfile: investorはdetailを空にする [AC-039-1]", () => {
    const issues = [{ projectId: "PJ-002", detail: "機密の詳細", reportedByName: "田中太郎" }];
    const filtered = filterIssuesForProfile("investor", issues, ctx);
    expect(filtered[0]?.detail).toBe("");
    expect(filtered[0]?.reportedByName).toBeUndefined();
  });

  it("buildForbiddenTermsForProfile: PRF-05は個人名＋社内固有語", () => {
    const terms = buildForbiddenTermsForProfile("PRF-05", ["田中太郎"], ["社内システムX"]);
    expect(terms).toContain("田中太郎");
    expect(terms).toContain("社内システムX");
  });
  it("buildForbiddenTermsForProfile: PRF-02は禁止語なし", () => {
    expect(buildForbiddenTermsForProfile("PRF-02", ["田中太郎"], ["社内システムX"])).toHaveLength(0);
  });
});
