/**
 * packages/web/tests/chat/systemPrompt.test.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード：チャットによる動的表示切替）。
 *   buildSystemPrompt がペルソナ情報を埋め込むこと、および「数値を本文で述べず必ずtoolで
 *   表示すること」という制約が明記されることを検証する。
 */
import { describe, expect, it } from "vitest";
import type { ResolvedPersona } from "../../src/server/personaResolver";
import { buildSystemPrompt } from "../../src/server/chat/systemPrompt";

const prjopsExecutive: ResolvedPersona = {
  domain: "prjops",
  profile: "PRF-04",
  scope: { mode: "global", projectId: null },
  visibility: {
    recipientStakeholderId: "STK-EXEC",
    recipientManagedProjectIds: [],
    recipientAssignedProjectIds: [],
    recipientParticipatingProjectIds: [],
    investedProjectIds: [],
  },
};

const devopsManager: ResolvedPersona = {
  domain: "devops",
  profile: "PRF-G",
  scope: { mode: "global", projectId: null },
  visibility: { recipientUserId: "U-G", recipientAssignedProjectIds: [] },
};

const investor: ResolvedPersona = {
  domain: "investor",
  profile: "investor",
  scope: { mode: "project", projectId: "PJ-001" },
  visibility: {
    recipientStakeholderId: "STK-INV",
    recipientManagedProjectIds: [],
    recipientAssignedProjectIds: [],
    recipientParticipatingProjectIds: [],
    investedProjectIds: [],
  },
};

describe("buildSystemPrompt（ADR-0005: ペルソナ情報の埋め込み）", () => {
  it("PrjOpsペルソナのドメイン名とprofileを埋め込む", () => {
    const prompt = buildSystemPrompt(prjopsExecutive);
    expect(prompt).toContain("PrjOps");
    expect(prompt).toContain("PRF-04");
  });

  it("DevOpsペルソナのドメイン名とprofileを埋め込む", () => {
    const prompt = buildSystemPrompt(devopsManager);
    expect(prompt).toContain("DevOps");
    expect(prompt).toContain("PRF-G");
  });

  it("Investorペルソナのドメイン名を埋め込む [REQ-039]", () => {
    expect(buildSystemPrompt(investor)).toContain("Investor investor");
  });

  it("数値を本文で述べず必ずtoolで表示することを明記する（CLAUDE.md設計原則2）", () => {
    const prompt = buildSystemPrompt(prjopsExecutive);
    expect(prompt).toContain("数値");
    expect(prompt).toMatch(/tool/);
  });

  it("2件のペルソナで生成結果が異なる（ペルソナ非依存の固定文字列になっていない）", () => {
    expect(buildSystemPrompt(prjopsExecutive)).not.toBe(buildSystemPrompt(devopsManager));
  });
});
