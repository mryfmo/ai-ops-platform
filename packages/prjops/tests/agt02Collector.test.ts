/** 根拠: REQ-004, REQ-005, SPEC-INT-030, AC-005-1, AC-005-2 */
import { describe, expect, it } from "vitest";
import { InMemoryAuditLog } from "@aiops/shared/auditLog.js";
import type { AnthropicStructuredClient, StructuredCallOptions } from "@aiops/shared/clients/anthropicClient.js";
import {
  ingestOne,
  resolveProjectId,
  type CollectorDependencies,
  type IncomingReport,
} from "../src/agents/AGT02_collector.js";
import type { StructuredStatusUpdate } from "../src/lib/freeTextValidation.js";

const complete: StructuredStatusUpdate = {
  progress_pct: 60,
  self_status: "green",
  achievements: "設計を完了",
  plans: "実装を開始",
  issues: "なし",
  risks: "なし",
};

function harness(value: unknown, stakeholderId: string | null = "ST-001", exactIdentifier?: string) {
  const calls: StructuredCallOptions<unknown>[] = [];
  const lookupIdentifiers: string[] = [];
  const auditLog = new InMemoryAuditLog();
  const llmClient = {
    call: async (options: StructuredCallOptions<unknown>) => {
      calls.push(options);
      return { value: options.parse(value), model: "mock", attempts: 1, usage: { input_tokens: 0, output_tokens: 0 } };
    },
  } as unknown as AnthropicStructuredClient;
  const deps: CollectorDependencies = {
    llmClient,
    auditLog,
    traceId: "trace-agt02",
    stakeholderLookup: {
      findBySenderIdentifier: async (identifier) => {
        lookupIdentifiers.push(identifier);
        return stakeholderId && (!exactIdentifier || identifier === exactIdentifier) ? { stakeholderId } : null;
      },
    },
  };
  return { deps, auditLog, calls, lookupIdentifiers };
}

const report: IncomingReport = {
  channel: "teams",
  senderIdentifier: "teams-user-001",
  subject: "PJ-101 週次報告",
  body: "進捗報告",
};

describe("AGT-02 ingestOne DI結線 [REQ-004, REQ-005, SPEC-INT-030]", () => {
  it("AC-005-1: 欠落時は聞き返し、構造化判断を正確に一件だけ追記監査する", async () => {
    const { deps, auditLog, calls } = harness({ ...complete, risks: null });

    await expect(ingestOne(report, { clarifyCount: 0 }, deps)).resolves.toEqual({
      kind: "clarify",
      message: "不足: ⑥リスク",
      clarifyCount: 1,
    });
    expect(await auditLog.readAll()).toHaveLength(1);
    expect((await auditLog.readAll())[0]).toMatchObject({
      trace_id: "trace-agt02",
      actor: "AGT-02",
      action: "structure",
      basis: "REQ-005",
      detail: { projectId: "PJ-101", stakeholderId: "ST-001", raw_source_channel: "teams", complete: false },
    });
    expect(calls[0]).toMatchObject({
      agent: "AGT-02",
      purpose: "free_text_structuring",
      user: "進捗報告",
      maxAttempts: 2,
      allowEscalation: true,
    });
    expect(calls[0]?.inputSchema).toMatchObject({ required: expect.arrayContaining(["progress_pct", "risks"]) });
  });

  it("REQ-005: 充足時は受理して構造化判断を正確に一件だけ追記監査する", async () => {
    const { deps, auditLog } = harness(complete);
    const outcome = await ingestOne(report, { clarifyCount: 0 }, deps);

    expect(outcome).toEqual({
      kind: "accepted",
      structured: complete,
      projectId: "PJ-101",
      stakeholderId: "ST-001",
    });
    expect(await auditLog.readAll()).toHaveLength(1);
    expect((await auditLog.readAll())[0]).toMatchObject({
      action: "structure",
      detail: { projectId: "PJ-101", stakeholderId: "ST-001", raw_source_channel: "teams", complete: true },
    });
  });

  it("REQ-032: accepted出力はknown自由文だけを再構築・sanitizeしextraを破棄する", async () => {
    const secret = `ghp_${"a".repeat(24)}`;
    const raw = { ...complete, achievements: `完了 ${secret}`, extra: `漏洩 ${secret}` };
    const { deps } = harness(raw);

    const outcome = await ingestOne(report, { clarifyCount: 0 }, deps);

    expect(outcome).toEqual({
      kind: "accepted",
      structured: { ...complete, achievements: "完了 ***REDACTED:github_pat***" },
      projectId: "PJ-101",
      stakeholderId: "ST-001",
    });
    expect(JSON.stringify(outcome)).not.toContain(secret);
    expect(outcome).not.toHaveProperty("structured.extra");
  });

  it("AC-005-2: 聞き返し上限後はエスカレーションして構造化判断を正確に一件だけ監査する", async () => {
    const partial = { ...complete, progress_pct: null };
    const { deps, auditLog } = harness(partial);

    await expect(ingestOne(report, { clarifyCount: 3 }, deps)).resolves.toEqual({
      kind: "escalate_incomplete",
      lastPartial: partial,
    });
    expect(await auditLog.readAll()).toHaveLength(1);
    expect((await auditLog.readAll())[0]).toMatchObject({
      action: "structure",
      detail: { projectId: "PJ-101", stakeholderId: "ST-001", raw_source_channel: "teams", complete: false },
    });
  });

  it("REQ-032: escalate出力もcompat secretをsanitizeしextraを破棄する", async () => {
    const secret = `ｇｈｐ＿${"a".repeat(24)}`;
    const raw = { ...complete, progress_pct: null, risks: `懸念 ${secret}`, extra: secret };
    const { deps } = harness(raw);

    const outcome = await ingestOne(report, { clarifyCount: 3 }, deps);

    expect(outcome).toEqual({
      kind: "escalate_incomplete",
      lastPartial: { ...complete, progress_pct: null, risks: "懸念 ***REDACTED:github_pat***" },
    });
    expect(JSON.stringify(outcome)).not.toContain(secret);
    expect(JSON.stringify(outcome)).not.toContain(secret.normalize("NFKC"));
    expect(outcome).not.toHaveProperty("lastPartial.extra");
  });

  it("REQ-032 / SPEC-INT-030 E-ING01: secret形状の未知送信者を原値で照合し監査だけ無害化する", async () => {
    const secret = `sk-ant-${"a".repeat(24)}`;
    const { deps, auditLog, lookupIdentifiers } = harness(complete, null);

    await expect(ingestOne({ ...report, senderIdentifier: secret }, { clarifyCount: 0 }, deps)).resolves.toEqual({
      kind: "rejected_unknown_sender",
    });
    expect(lookupIdentifiers).toEqual([secret]);
    expect(JSON.stringify(await auditLog.readAll())).not.toContain(secret);
  });

  it("REQ-032 / SPEC-INT-030 E-ING02: secret形状の既知送信者を原値で照合し監査だけ無害化する", async () => {
    const secret = `ghp_${"a".repeat(24)}`;
    const { deps, auditLog, lookupIdentifiers } = harness(complete);

    await expect(
      ingestOne(
        { ...report, senderIdentifier: secret, subject: undefined, body: "対象名なし" },
        { clarifyCount: 0 },
        deps,
      ),
    ).resolves.toEqual({ kind: "rejected_unresolved_project" });
    expect(lookupIdentifiers).toEqual([secret]);
    expect(JSON.stringify(await auditLog.readAll())).not.toContain(secret);
  });

  it("REQ-032 / SPEC-INT-030 E-ING01: compatibility secretを原値照合し、正規形も監査しない", async () => {
    const secret = `ｇｈｐ＿${"a".repeat(24)}`;
    const canonicalSecret = secret.normalize("NFKC");
    const { deps, auditLog, lookupIdentifiers } = harness(complete, null);

    await expect(ingestOne({ ...report, senderIdentifier: secret }, { clarifyCount: 0 }, deps)).resolves.toEqual({
      kind: "rejected_unknown_sender",
    });
    expect(lookupIdentifiers).toEqual([secret]);
    const audit = JSON.stringify(await auditLog.readAll());
    expect(audit).not.toContain(secret);
    expect(audit).not.toContain(canonicalSecret);
  });

  it("REQ-004 / REQ-032: redaction後に衝突する識別子もexact-key stakeholder lookupで区別する", async () => {
    const known = `ghp_${"a".repeat(24)}`;
    const collision = `ghp_${"b".repeat(24)}`;
    const accepted = harness(complete, "ST-SECRET", known);
    const rejected = harness(complete, "ST-SECRET", known);

    await expect(
      ingestOne({ ...report, senderIdentifier: known }, { clarifyCount: 0 }, accepted.deps),
    ).resolves.toMatchObject({ kind: "accepted", stakeholderId: "ST-SECRET" });
    await expect(
      ingestOne({ ...report, senderIdentifier: collision }, { clarifyCount: 0 }, rejected.deps),
    ).resolves.toEqual({ kind: "rejected_unknown_sender" });
    expect(accepted.lookupIdentifiers).toEqual([known]);
    expect(rejected.lookupIdentifiers).toEqual([collision]);
    expect(JSON.stringify(await rejected.auditLog.readAll())).not.toContain(collision);
  });

  it("SPEC-INT-020 / SPEC-INT-030: malformed構造化出力はruntime parseでfail closedにする", async () => {
    const { deps, auditLog } = harness({ ...complete, progress_pct: 101 });
    await expect(ingestOne(report, { clarifyCount: 0 }, deps)).rejects.toThrow("E-ING03");
    expect(await auditLog.readAll()).toEqual([]);
  });

  it.each([
    ["missing field", { progress_pct: 60, self_status: "green", achievements: "完了", plans: "開始", issues: "なし" }],
    ["invalid self_status", { ...complete, self_status: "blue" }],
    ["non-string self_status", { ...complete, self_status: ["green"] }],
    ["null body", null],
    ["array body", [complete]],
    ["non-string achievements", { ...complete, achievements: ["完了"] }],
  ])("SPEC-INT-020 / SPEC-INT-030: %sをruntime parserで拒否する", async (_name, raw) => {
    const { deps, auditLog } = harness(raw);
    await expect(ingestOne(report, { clarifyCount: 0 }, deps)).rejects.toThrow("E-ING03");
    expect(await auditLog.readAll()).toEqual([]);
  });

  it("SPEC-INT-030 E-ING01: 未知の送信者はLLMを呼ばず拒否し、非秘密識別子を監査する", async () => {
    const { deps, auditLog, calls } = harness(complete, null);

    await expect(ingestOne(report, { clarifyCount: 0 }, deps)).resolves.toEqual({
      kind: "rejected_unknown_sender",
    });
    expect(calls).toHaveLength(0);
    expect(await auditLog.readAll()).toEqual([
      expect.objectContaining({
        trace_id: "trace-agt02",
        actor: "AGT-02",
        action: "reject_unknown_sender",
        basis: "SPEC-INT-030 E-ING01",
        detail: { senderIdentifier: "teams-user-001" },
      }),
    ]);
  });

  it("SPEC-INT-030 E-ING02: プロジェクト不明はLLMを呼ばず拒否して監査する", async () => {
    const { deps, auditLog, calls } = harness(complete);
    const unresolved = { ...report, subject: undefined, body: "対象名なし" };

    await expect(ingestOne(unresolved, { clarifyCount: 0 }, deps)).resolves.toEqual({
      kind: "rejected_unresolved_project",
    });
    expect(calls).toHaveLength(0);
    expect(await auditLog.readAll()).toEqual([
      expect.objectContaining({
        trace_id: "trace-agt02",
        actor: "AGT-02",
        action: "reject_unresolved_project",
        basis: "SPEC-INT-030 E-ING02",
      }),
    ]);
  });

  it("SPEC-INT-030: 対象PJは件名、本文、送信者ヒントの優先順で解決する", () => {
    expect(resolveProjectId({ ...report, body: "PJ-202" })).toBe("PJ-101");
    expect(resolveProjectId({ ...report, subject: undefined, body: "PJ-202" })).toBe("PJ-202");
    expect(resolveProjectId({ ...report, subject: undefined, body: "なし", projectIdHintFromSender: "PJ-303" })).toBe(
      "PJ-303",
    );
  });
});
