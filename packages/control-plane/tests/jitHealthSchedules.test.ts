// 根拠: DevOps:SPEC-INT-032 / DevOps:SPEC-INT-040 / REQ-029 / TH-007 / ADR-0021
import { ScheduleAlreadyRunning } from "@temporalio/client";
import { describe, expect, it, vi } from "vitest";

import { HEALTH_EVALUATION_INTERVAL_MS, JIT_EXPIRY_INTERVAL_MS } from "../src/lib/jitHealthState.js";
import { buildJitHealthSchedules } from "../src/lib/jitHealthSchedules.js";
import { registerJitHealthSchedules } from "../src/workflows/jitHealthScheduleRegistration.js";

describe("DevOps:SPEC-INT-032/040 JIT・health Temporal Schedules", () => {
  const registration = {
    executionMode: "shadow" as const,
    sequence: 0,
    observedAtMs: 1_000,
    taskQueue: "aiops-control-plane",
  };

  it("毎分JITと30秒healthを drift-free recurring Schedule として構築する", () => {
    const schedules = buildJitHealthSchedules(registration);
    expect(schedules.map((schedule) => schedule.scheduleId)).toEqual([
      "incident/jit-expiry:global:0/schedule",
      "incident/health:global:0/schedule",
    ]);
    expect(schedules.map((schedule) => schedule.spec.intervals?.[0]?.every)).toEqual([
      JIT_EXPIRY_INTERVAL_MS,
      HEALTH_EVALUATION_INTERVAL_MS,
    ]);
    expect(schedules.map((schedule) => schedule.action.workflowType)).toEqual([
      "jitExpiryWorkflow",
      "healthEvaluationWorkflow",
    ]);
    expect(schedules.every((schedule) => schedule.action.type === "startWorkflow")).toBe(true);
    expect(schedules.every((schedule) => schedule.policies?.overlap === "SKIP")).toBe(true);
    expect(schedules.map((schedule) => schedule.policies?.catchupWindow)).toEqual([
      JIT_EXPIRY_INTERVAL_MS,
      HEALTH_EVALUATION_INTERVAL_MS,
    ]);
    for (const schedule of schedules) {
      const every = schedule.spec.intervals?.[0]?.every as number;
      const startAtMs = schedule.spec.startAt?.getTime() as number;
      expect(schedule.spec.intervals?.[0]?.offset).toBe(startAtMs % every);
    }
  });

  it("2 schedules を注入 client へ登録する", async () => {
    const create = vi.fn(async () => undefined);
    await registerJitHealthSchedules({ create }, registration);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("既存 schedule は成功扱いにし、それ以外の create error は伝播する", async () => {
    let calls = 0;
    const create = vi.fn(async (schedule: { scheduleId: string }) => {
      calls += 1;
      if (calls === 1) throw new ScheduleAlreadyRunning("already exists", schedule.scheduleId);
    });
    await expect(registerJitHealthSchedules({ create }, registration)).resolves.toBeUndefined();
    expect(create).toHaveBeenCalledTimes(2);

    const failure = new Error("Temporal unavailable");
    await expect(
      registerJitHealthSchedules(
        {
          create: vi.fn(async () => {
            throw failure;
          }),
        },
        registration,
      ),
    ).rejects.toBe(failure);
  });
});
