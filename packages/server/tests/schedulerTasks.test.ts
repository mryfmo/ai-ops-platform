/**
 * packages/server/tests/schedulerTasks.test.ts
 *
 * 根拠: REQ-029（3回連続不応答でフェイルセーフ、回復で解除）/ TH-007・SPEC-INT-032（JIT失効の
 *   台帳読込→剥奪→台帳反映）
 */
import { describe, it, expect } from "vitest";
import { InMemoryAuditLog } from "@aiops/shared";
import type { GrantRecord } from "@aiops/devops";
import { createHealthcheckTask } from "../src/scheduler/tasks/healthcheckTask.js";
import { createJitRevocationTask } from "../src/scheduler/tasks/jitRevocationTask.js";
import type { GrantsRepo } from "../src/db/grantsRepo.js";

describe("healthcheckTask (REQ-029)", () => {
  function setup(results: Array<boolean | Error>) {
    const auditLog = new InMemoryAuditLog();
    let failsafe = false;
    let activated = 0;
    let i = 0;
    const task = createHealthcheckTask({
      checkTargets: async () => {
        const r = results[Math.min(i++, results.length - 1)]!;
        if (r instanceof Error) throw r;
        return r;
      },
      activateFailsafe: async () => {
        activated += 1;
      },
      isFailsafeActive: () => failsafe,
      setFailsafeActive: (v) => {
        failsafe = v;
      },
      auditLog,
      traceIdProvider: () => "trace-hc",
    });
    return { task, auditLog, getFailsafe: () => failsafe, getActivated: () => activated };
  }

  it("3回連続失敗でフェイルセーフ発動+監査ログ（AC: REQ-029）", async () => {
    const { task, auditLog, getFailsafe, getActivated } = setup([false, false, false]);
    const now = new Date("2026-07-07T00:00:00Z");
    await task.run(now);
    await task.run(now);
    expect(getFailsafe()).toBe(false); // 2回ではまだ
    await task.run(now);
    expect(getFailsafe()).toBe(true);
    expect(getActivated()).toBe(1);
    const logs = await auditLog.readAll();
    expect(logs.some((l) => l.action === "failsafe_activated" && l.basis === "REQ-029")).toBe(true);
  });

  it("例外も失敗1回と数える", async () => {
    const { task, getFailsafe } = setup([new Error("db down"), new Error("db down"), new Error("db down")]);
    const now = new Date();
    await task.run(now);
    await task.run(now);
    await task.run(now);
    expect(getFailsafe()).toBe(true);
  });

  it("回復でフェイルセーフ解除+監査ログ", async () => {
    const { task, auditLog, getFailsafe } = setup([false, false, false, true]);
    const now = new Date();
    await task.run(now);
    await task.run(now);
    await task.run(now);
    expect(getFailsafe()).toBe(true);
    await task.run(now);
    expect(getFailsafe()).toBe(false);
    const logs = await auditLog.readAll();
    expect(logs.some((l) => l.action === "failsafe_recovered")).toBe(true);
  });

  it("発動は1回だけ（継続失敗で重複発動しない）", async () => {
    const { task, getActivated } = setup([false, false, false, false, false]);
    const now = new Date();
    for (let i = 0; i < 5; i++) await task.run(now);
    expect(getActivated()).toBe(1);
  });
});

describe("jitRevocationTask (TH-007 / SPEC-INT-032)", () => {
  it("期限到来grantをGitHubから剥奪し台帳へ反映する", async () => {
    const auditLog = new InMemoryAuditLog();
    const removed: string[] = [];
    const marked: string[][] = [];
    const grants: GrantRecord[] = [
      {
        grantId: "g-expired",
        subject: "ext-user",
        targetOwner: "acme",
        targetRepo: "repo",
        level: "push",
        expiresAt: "2026-07-06T00:00:00Z",
        revokedAt: null,
      },
      {
        grantId: "g-active",
        subject: "dev-a",
        targetOwner: "acme",
        targetRepo: "repo",
        level: "pull",
        expiresAt: "2026-08-01T00:00:00Z",
        revokedAt: null,
      },
    ];
    const grantsRepo = {
      loadActiveGrants: async () => grants,
      markRevoked: async (ids: string[]) => {
        marked.push(ids);
      },
    } as unknown as GrantsRepo;

    const task = createJitRevocationTask({
      grantsRepo,
      secDeps: {
        githubClient: {
          putCollaboratorPermission: async () => {},
          removeCollaborator: async (_o: string, _r: string, username: string) => {
            removed.push(username);
          },
        },
        auditLog,
      },
      traceIdProvider: () => "trace-jit",
    });

    await task.run(new Date("2026-07-07T00:00:00Z"));
    expect(removed).toEqual(["ext-user"]);
    expect(marked).toEqual([["g-expired"]]);
    const logs = await auditLog.readAll();
    expect(logs.some((l) => l.action === "auto_revoke" && l.basis === "TH-007")).toBe(true);
  });

  it("JIT失効revokeはfailsafe guardの対象外として実行される", async () => {
    const removed: string[] = [];
    const marked: string[][] = [];
    const grantsRepo = {
      loadActiveGrants: async () =>
        [
          {
            grantId: "g-expired",
            subject: "ext-user",
            targetOwner: "acme",
            targetRepo: "repo",
            level: "push",
            expiresAt: "2026-07-06T00:00:00Z",
            revokedAt: null,
          },
        ] as GrantRecord[],
      markRevoked: async (ids: string[]) => {
        marked.push(ids);
      },
    } as unknown as GrantsRepo;

    const task = createJitRevocationTask({
      grantsRepo,
      secDeps: {
        githubClient: {
          putCollaboratorPermission: async () => {},
          removeCollaborator: async (_o: string, _r: string, username: string) => {
            removed.push(username);
          },
        },
        auditLog: new InMemoryAuditLog(),
      },
      traceIdProvider: () => "trace-jit",
    });

    await task.run(new Date("2026-07-07T00:00:00Z"));
    expect(removed).toEqual(["ext-user"]);
    expect(marked).toEqual([["g-expired"]]);
  });

  it("期限未到来のみなら何もしない", async () => {
    const marked: string[][] = [];
    const grantsRepo = {
      loadActiveGrants: async () =>
        [
          {
            grantId: "g-1",
            subject: "dev-a",
            targetOwner: "acme",
            targetRepo: "repo",
            level: "pull",
            expiresAt: "2099-01-01T00:00:00Z",
            revokedAt: null,
          },
        ] as GrantRecord[],
      markRevoked: async (ids: string[]) => {
        marked.push(ids);
      },
    } as unknown as GrantsRepo;

    const task = createJitRevocationTask({
      grantsRepo,
      secDeps: {
        githubClient: { putCollaboratorPermission: async () => {}, removeCollaborator: async () => {} },
        auditLog: new InMemoryAuditLog(),
      },
      traceIdProvider: () => "trace-jit",
    });
    await task.run(new Date());
    expect(marked).toEqual([[]]);
  });
});
