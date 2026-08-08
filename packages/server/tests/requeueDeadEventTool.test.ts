/**
 * packages/server/tests/requeueDeadEventTool.test.ts
 *
 * 根拠: DevOps:SPEC-INT-010 / ADV-OPS-008。dead event 復旧CLIの引数と監査経路への配線を検証する。
 */
import { describe, expect, it, vi } from "vitest";
import {
  loadRequeueDeadDatabaseConfig,
  parseRequeueDeadArgs,
  requeueDeadEventFromCliArgs,
} from "../src/tools/requeueDeadEvent.js";

describe("dead event recovery CLI [DevOps:SPEC-INT-010]", () => {
  it("必須引数をparseする [DevOps:SPEC-INT-010]", () => {
    expect(
      parseRequeueDeadArgs([
        "--eventId",
        "11111111-1111-4111-8111-111111111111",
        "--actor",
        "operator@example.com",
        "--reason",
        "INC-123: upstream outage resolved",
      ]),
    ).toEqual({
      eventId: "11111111-1111-4111-8111-111111111111",
      actor: "operator@example.com",
      reason: "INC-123: upstream outage resolved",
    });
  });

  it("EventsRepo.requeueDeadの監査付き経路を呼ぶ [DevOps:SPEC-INT-010]", async () => {
    const requeueDead = vi.fn().mockResolvedValue({ eventId: "evt-dead", attempts: 5 });

    await expect(
      requeueDeadEventFromCliArgs(
        { eventId: "evt-dead", actor: "operator-1", reason: "INC-123: resolved" },
        { requeueDead },
        () => "11111111-1111-4111-8111-111111111111",
      ),
    ).resolves.toEqual({ eventId: "evt-dead", attempts: 5, traceId: "11111111-1111-4111-8111-111111111111" });

    expect(requeueDead).toHaveBeenCalledWith("evt-dead", {
      actor: "operator-1",
      reason: "INC-123: resolved",
      traceId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("対象がdeadでなければ失敗する [DevOps:SPEC-INT-010]", async () => {
    const requeueDead = vi.fn().mockResolvedValue(null);

    await expect(
      requeueDeadEventFromCliArgs(
        { eventId: "evt-not-dead", actor: "operator-1", reason: "INC-123: resolved" },
        { requeueDead },
        () => "11111111-1111-4111-8111-111111111111",
      ),
    ).rejects.toThrow("event is not dead or does not exist");
  });

  it("actorをCLI境界でも検証する [DevOps:SPEC-INT-010]", () => {
    expect(() =>
      parseRequeueDeadArgs([
        "--eventId",
        "11111111-1111-4111-8111-111111111111",
        "--actor",
        "operator name",
        "--reason",
        "INC-123: resolved",
      ]),
    ).toThrow("valid actor identifier");
  });

  it("DATABASE_URL以外のserver設定なしでDB設定を読む [DevOps:SPEC-INT-010]", () => {
    expect(loadRequeueDeadDatabaseConfig({ DATABASE_URL: "postgres://localhost/aiops" })).toEqual({
      databaseUrl: "postgres://localhost/aiops",
      max: 10,
      connectionTimeoutMillis: 5_000,
      statementTimeoutMs: 30_000,
      idleInTransactionSessionTimeoutMs: 30_000,
    });
  });
});
