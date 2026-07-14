/** ADR-0005 / PrjOps:REQ-042 / SPEC-INT-069: fail-closed Microsoft Graph sandbox smoke harness tests. */
import { mkdir, mkdtemp, readFile, readdir, realpath, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseGraphSmokeArgs,
  runGraphSmoke,
  type GraphSmokeOperations,
  type GraphSmokeRequestMetadata,
} from "../src/tools/graphSmoke.js";

const UUIDS = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
  "10000000-0000-4000-8000-000000000004",
  "10000000-0000-4000-8000-000000000005",
  "10000000-0000-4000-8000-000000000006",
];

function metadata(status: number, index: number): GraphSmokeRequestMetadata {
  return {
    clientRequestId: UUIDS[index]!,
    requestId: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    date: "Sat, 11 Jul 2026 00:00:00 GMT",
    status,
  };
}

async function validArgs() {
  const dir = await mkdtemp(join(await realpath(tmpdir()), "graph-smoke-"));
  return parseGraphSmokeArgs(
    [
      "--sandbox",
      "--teamId",
      "team-private-1",
      "--channelId",
      "channel-private-1",
      "--senderMailbox",
      "sender@example.test",
      "--recipient",
      "recipient@example.test",
      "--notificationUrl",
      "https://aiops.example.test/webhooks/graph",
      "--lifecycleNotificationUrl",
      "https://aiops.example.test/webhooks/graph",
      "--evidencePath",
      join(dir, "evidence.json"),
    ],
    { AIOPS_GRAPH_SMOKE_ENABLED: "true" },
  );
}

function operations(events: string[], failAt?: keyof GraphSmokeOperations): GraphSmokeOperations {
  const step = async <T>(name: keyof GraphSmokeOperations, value: T): Promise<T> => {
    events.push(name);
    if (failAt === name) throw new Error(`private-${name}-failure`);
    return value;
  };
  return {
    createSubscription: async () =>
      step("createSubscription", { subscriptionId: "subscription-private-1", metadata: metadata(201, 0) }),
    sendMail: async () => step("sendMail", metadata(202, 1)),
    postTeamsMessage: async () =>
      step("postTeamsMessage", { messageId: "message-private-1", metadata: metadata(201, 2) }),
    verifyCreatedNotification: async () => step("verifyCreatedNotification", metadata(200, 3)),
    verifyLifecycleNotification: async () => step("verifyLifecycleNotification", metadata(200, 4)),
    countCorrelatedDbEvents: async () => step("countCorrelatedDbEvents", 3),
    deleteSubscription: async (subscriptionId) => {
      events.push("deleteSubscription");
      if (typeof subscriptionId !== "string" || !subscriptionId || subscriptionId !== subscriptionId.trim())
        throw new Error("unsafe subscription ID");
      if (failAt === "deleteSubscription") throw new Error("private-deleteSubscription-failure");
      return metadata(204, 5);
    },
  };
}

function policyFor(args: Awaited<ReturnType<typeof validArgs>>, overrides = {}) {
  return {
    allowedTeamIds: ["team-private-1"],
    allowedFromMailboxes: ["sender@example.test", "recipient@example.test"],
    expectedNotificationUrl: "https://aiops.example.test/webhooks/graph",
    expectedLifecycleNotificationUrl: "https://aiops.example.test/webhooks/graph",
    expectedEvidenceRoot: dirname(args.evidencePath),
    ...overrides,
  };
}

describe("Graph sandbox smoke harness [ADR-0005 PrjOps:REQ-042 SPEC-INT-069]", () => {
  beforeEach(() => vi.stubEnv("AIOPS_GRAPH_SMOKE_ENABLED", "true"));
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["sandbox flag", ["--teamId", "team-private-1"], { AIOPS_GRAPH_SMOKE_ENABLED: "true" }],
    ["environment opt-in", ["--sandbox"], {}],
  ])("二重opt-inが欠けると拒否する: %s", (_label, argv, env) => {
    expect(() => parseGraphSmokeArgs(argv, env)).toThrow(/disabled|sandbox/i);
  });

  it("run APIもopt-inを再検証し、forged sandbox argsをoperation取得前に拒否する", async () => {
    vi.stubEnv("AIOPS_GRAPH_SMOKE_ENABLED", "TRUE");
    const args = await validArgs();
    let acquired = 0;
    await expect(runGraphSmoke(args, policyFor(args), async () => ((acquired += 1), operations([])))).rejects.toThrow(
      /disabled/i,
    );
    expect(acquired).toBe(0);
  });

  it("oversized入力をoperation取得前に拒否する", async () => {
    const args = await validArgs();
    let acquired = 0;
    await expect(
      runGraphSmoke(
        { ...args, teamId: "x".repeat(257) },
        policyFor(args),
        async () => ((acquired += 1), operations([])),
      ),
    ).rejects.toThrow(/length|canonical/i);
    expect(acquired).toBe(0);
  });

  it("existing evidenceを上書きせずoperation取得前に拒否する", async () => {
    const args = await validArgs();
    await writeFile(args.evidencePath, "keep-existing\n", "utf8");
    let acquired = 0;
    await expect(runGraphSmoke(args, policyFor(args), async () => ((acquired += 1), operations([])))).rejects.toThrow(
      /exists/i,
    );
    expect(acquired).toBe(0);
    expect(await readFile(args.evidencePath, "utf8")).toBe("keep-existing\n");
  });

  it("symlink evidence root/parentをoperation取得前に拒否する", async () => {
    const parent = await mkdtemp(join(await realpath(tmpdir()), "graph-smoke-link-"));
    const actualRoot = join(parent, "actual");
    const linkedRoot = join(parent, "linked");
    await mkdir(actualRoot);
    await symlink(actualRoot, linkedRoot);
    const base = await validArgs();
    const args = { ...base, evidencePath: join(linkedRoot, "evidence.json") };
    let acquired = 0;
    await expect(runGraphSmoke(args, policyFor(args), async () => ((acquired += 1), operations([])))).rejects.toThrow(
      /symlink|canonical/i,
    );
    expect(acquired).toBe(0);
  });

  it("evidence pathはexact real rootのdirect childだけを許可する", async () => {
    const base = await validArgs();
    const nested = join(dirname(base.evidencePath), "nested");
    await mkdir(nested);
    const args = { ...base, evidencePath: join(nested, "evidence.json") };
    let acquired = 0;
    await expect(runGraphSmoke(args, policyFor(base), async () => ((acquired += 1), operations([])))).rejects.toThrow(
      /root|direct/i,
    );
    expect(acquired).toBe(0);
  });

  it.each([
    ["missing input", "channelId", ""],
    ["noncanonical team", "teamId", " team-private-1"],
    ["noncanonical sender", "senderMailbox", "Sender@example.test"],
    ["noncanonical recipient", "recipient", "recipient@example.test "],
    ["HTTP notification", "notificationUrl", "http://aiops.example.test/webhooks/graph"],
    ["URL credentials", "lifecycleNotificationUrl", "https://user@aiops.example.test/lifecycle"],
    ["relative evidence", "evidencePath", "evidence.json"],
  ])("必須値とcanonical値をoperation取得前に拒否する: %s", async (_label, key, value) => {
    const args = await validArgs();
    let acquired = 0;
    await expect(
      runGraphSmoke({ ...args, [key]: value }, policyFor(args), async () => ((acquired += 1), operations([]))),
    ).rejects.toThrow();
    expect(acquired).toBe(0);
  });

  it.each([
    ["team", { allowedTeamIds: ["other"] }],
    ["sender", { allowedFromMailboxes: ["recipient@example.test"] }],
    ["recipient", { allowedFromMailboxes: ["sender@example.test"] }],
    ["notification URL", { expectedNotificationUrl: "https://other.example.test/webhooks/graph" }],
    ["lifecycle URL", { expectedLifecycleNotificationUrl: "https://other.example.test/webhooks/graph" }],
  ])("T07 allowlist不一致をoperation取得前に拒否する: %s", async (_label, override) => {
    const args = await validArgs();
    let acquired = 0;
    await expect(
      runGraphSmoke(args, policyFor(args, override), async () => ((acquired += 1), operations([]))),
    ).rejects.toThrow(/allowed/i);
    expect(acquired).toBe(0);
  });

  it("購読作成前の失敗はcleanupせず、作成後の成功はcleanupを一度だけ行う", async () => {
    const beforeArgs = await validArgs();
    const before: string[] = [];
    await expect(
      runGraphSmoke(beforeArgs, policyFor(beforeArgs), async () => operations(before, "createSubscription")),
    ).rejects.toThrow(/smoke failed/i);
    expect(before).toEqual(["createSubscription"]);

    const successArgs = await validArgs();
    const success: string[] = [];
    await runGraphSmoke(successArgs, policyFor(successArgs), async () => operations(success));
    expect(success.filter((event) => event === "deleteSubscription")).toHaveLength(1);
    expect(success.at(-1)).toBe("deleteSubscription");
  });

  it.each([
    "sendMail",
    "postTeamsMessage",
    "verifyCreatedNotification",
    "verifyLifecycleNotification",
    "countCorrelatedDbEvents",
    "deleteSubscription",
  ] as const)("購読作成後の失敗でもcleanupをexactly once試行する: %s", async (failAt) => {
    const args = await validArgs();
    const events: string[] = [];
    await expect(runGraphSmoke(args, policyFor(args), async () => operations(events, failAt))).rejects.toThrow(
      /smoke failed/i,
    );
    expect(events.filter((event) => event === "deleteSubscription")).toHaveLength(1);
  });

  it("DB event countへsubscription/message/client request IDsを明示相関する", async () => {
    const args = await validArgs();
    const ops = operations([]);
    let received: unknown;
    ops.countCorrelatedDbEvents = async (_args, correlation) => {
      received = correlation;
      return 3;
    };
    await runGraphSmoke(args, policyFor(args), async () => ops);
    expect(received).toEqual({
      subscriptionId: "subscription-private-1",
      messageId: "message-private-1",
      clientRequestIds: UUIDS.slice(0, 5),
    });
  });

  it("correlated DB event count zeroを失敗扱いにしてcleanupする", async () => {
    const args = await validArgs();
    const events: string[] = [];
    const ops = operations(events);
    ops.countCorrelatedDbEvents = async () => 0;
    await expect(runGraphSmoke(args, policyFor(args), async () => ops)).rejects.toThrow(/smoke failed/i);
    expect(events.filter((event) => event === "deleteSubscription")).toHaveLength(1);
    expect(JSON.parse(await readFile(args.evidencePath, "utf8")).dbEventCount).toBe(0);
  });

  it.each([
    ["client request", { ...metadata(201, 0), clientRequestId: "not-a-uuid" }],
    ["Graph request", { ...metadata(201, 0), requestId: "secret@example.test" }],
    ["date", { ...metadata(201, 0), date: "private date" }],
    ["normalized date", { ...metadata(201, 0), date: "Sat, 31 Feb 2026 00:00:00 GMT" }],
    ["status", { ...metadata(201, 0), status: 200 }],
  ])("不正なcorrelation metadataを失敗させる: %s", async (_label, invalid) => {
    const args = await validArgs();
    const events: string[] = [];
    const ops = operations(events);
    ops.createSubscription = async () => ({ subscriptionId: "subscription-private-1", metadata: invalid });
    await expect(runGraphSmoke(args, policyFor(args), async () => ops)).rejects.toThrow(/smoke failed/i);
    expect(events.filter((event) => event === "deleteSubscription")).toHaveLength(1);
  });

  it.each([
    ["empty subscription", "", undefined, "failed"],
    ["undefined subscription", undefined, undefined, "failed"],
    ["malformed subscription", " subscription-private-1", undefined, "failed"],
    ["message", "subscription-private-1", " message-private-1", "passed"],
  ])(
    "Graph返却のopaque IDを検証し、create結果後はcleanupを一度行う: %s",
    async (_label, subscriptionId, messageId, cleanup) => {
      const args = await validArgs();
      const events: string[] = [];
      const ops = operations(events);
      ops.createSubscription = async () => ({ subscriptionId, metadata: metadata(201, 0) });
      if (messageId) ops.postTeamsMessage = async () => ({ messageId, metadata: metadata(201, 2) });
      await expect(runGraphSmoke(args, policyFor(args), async () => ops)).rejects.toThrow(/smoke failed/i);
      expect(events.filter((event) => event === "deleteSubscription")).toHaveLength(1);
      expect(JSON.parse(await readFile(args.evidencePath, "utf8")).status.cleanup).toBe(cleanup);
    },
  );

  it("fake E2E evidenceはatomic allowlisted schemaだけで、識別子・PII・secretを含まない", async () => {
    const args = await validArgs();
    const result = await runGraphSmoke(
      args,
      {
        ...policyFor(args),
        allowedTeamIds: [args.teamId],
        allowedFromMailboxes: [args.senderMailbox, args.recipient],
      },
      async () => operations([]),
      { now: (() => 1_000) as () => number },
    );
    const raw = await readFile(args.evidencePath, "utf8");
    expect(JSON.parse(raw)).toEqual(result);
    expect(Object.keys(result).sort()).toEqual(
      ["dbEventCount", "durationMs", "graphRequests", "resourceRefs", "schemaVersion", "status"].sort(),
    );
    for (const forbidden of [
      "team-private-1",
      "channel-private-1",
      "sender@example.test",
      "recipient@example.test",
      "subscription-private-1",
      "message-private-1",
      "token",
      "secret",
      "subject",
      "body",
    ]) {
      expect(raw.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
    expect(result.status).toEqual({
      sandbox: "passed",
      cleanup: "passed",
      updatedDeletedReceipt: "pending_delegated_or_ui_tenant_phase",
    });
    expect(result.graphRequests).toHaveLength(6);
    expect(Object.values(result.resourceRefs).every((value) => /^[0-9a-f]{64}$/.test(value))).toBe(true);
  });

  it("post-create失敗もcleanup後にredacted evidenceだけをatomic確定する", async () => {
    const args = await validArgs();
    const events: string[] = [];
    await expect(
      runGraphSmoke(args, policyFor(args), async () => operations(events, "postTeamsMessage")),
    ).rejects.toThrow(/smoke failed/i);
    expect(events.filter((event) => event === "deleteSubscription")).toHaveLength(1);
    const raw = await readFile(args.evidencePath, "utf8");
    expect(JSON.parse(raw).status).toEqual({
      sandbox: "failed",
      cleanup: "passed",
      updatedDeletedReceipt: "pending_delegated_or_ui_tenant_phase",
    });
    for (const forbidden of [
      "private-postTeamsMessage-failure",
      "team-private-1",
      "channel-private-1",
      "sender@example.test",
      "recipient@example.test",
      "subscription-private-1",
      "token",
      "secret",
    ]) {
      expect(raw.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
    expect((await readdir(dirname(args.evidencePath))).some((name) => name.endsWith(".tmp"))).toBe(false);
  });
});
