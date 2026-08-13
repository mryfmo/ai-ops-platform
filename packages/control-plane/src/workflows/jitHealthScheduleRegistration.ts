// 根拠: DevOps:SPEC-INT-032 / DevOps:SPEC-INT-040 / REQ-029 / TH-007 / ADR-0021
// Temporal client I/O を純粋な JIT/health schedule policy から分離する。

import { ScheduleAlreadyRunning, type ScheduleClient } from "@temporalio/client";

import { buildJitHealthSchedules, type JitHealthScheduleRegistration } from "../lib/jitHealthSchedules.js";

export async function registerJitHealthSchedules(
  client: Pick<ScheduleClient, "create">,
  registration: JitHealthScheduleRegistration,
): Promise<void> {
  await Promise.all(
    buildJitHealthSchedules(registration).map(async (schedule) => {
      try {
        await client.create(schedule);
      } catch (error) {
        if (!(error instanceof ScheduleAlreadyRunning)) throw error;
      }
    }),
  );
}
