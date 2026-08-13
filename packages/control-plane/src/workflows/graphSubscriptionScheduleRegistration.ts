// 根拠: FinalArch:FR-CP-004 / TMP-003 / ADR-0021
// Temporal client I/O を純粋 schedule policy から分離する薄い登録 orchestration。

import { ScheduleAlreadyRunning, type ScheduleClient } from "@temporalio/client";

import {
  buildGraphSubscriptionSchedules,
  type GraphSubscriptionScheduleRegistration,
} from "../lib/graphSubscriptionSchedules.js";

export async function registerGraphSubscriptionSchedules(
  client: Pick<ScheduleClient, "create">,
  registration: GraphSubscriptionScheduleRegistration,
): Promise<void> {
  await Promise.all(
    buildGraphSubscriptionSchedules(registration).map(async (schedule) => {
      try {
        await client.create(schedule);
      } catch (error) {
        if (!(error instanceof ScheduleAlreadyRunning)) throw error;
      }
    }),
  );
}
