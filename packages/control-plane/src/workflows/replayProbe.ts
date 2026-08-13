// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / ADR-0020
// TMP-001（Workflow replay succeeds）の対象 workflow。P3-T02 の 4 ヘルパ
// （retry class / idempotency / versioning / cancellation）を 1 本の決定的
// workflow で行使し、recorded history に対する replay test の被験体とする。

import { proxyActivities, sleep, workflowInfo } from "@temporalio/workflow";

import { buildIdempotencyKey } from "../lib/idempotency.js";
import { toTemporalRetryPolicy } from "../lib/retryPolicies.js";
import { guardSideEffectDispatch } from "./cancellation.js";
import { runExternalSideEffect } from "./sideEffect.js";
import { isPatchActive } from "./versioning.js";

/** probe が要求する activity 契約（実装は worker 側で注入。ここは型のみ）。 */
export interface ReplayProbeActivities {
  createExternalObject(input: { name: string }, idempotencyKey: string): Promise<string>;
  findExternalObject(idempotencyKey: string): Promise<string | null>;
}

const sideEffects = proxyActivities<Pick<ReplayProbeActivities, "createExternalObject">>({
  startToCloseTimeout: "30 seconds",
  retry: toTemporalRetryPolicy("external-side-effect"),
});

const reads = proxyActivities<Pick<ReplayProbeActivities, "findExternalObject">>({
  startToCloseTimeout: "30 seconds",
  retry: toTemporalRetryPolicy("read"),
});

/** 4 ヘルパを行使する決定的 probe。history fixture は tests/fixtures/ に保存される。 */
export async function replayProbeWorkflow(name: string): Promise<string> {
  const key = buildIdempotencyKey(workflowInfo().workflowId, "createExternalObject", 0);
  guardSideEffectDispatch("createExternalObject");
  const created = await runExternalSideEffect<{ name: string }, string>(
    {
      execute: async (input, idempotencyKey) => sideEffects.createExternalObject(input, idempotencyKey),
      reconcile: async (idempotencyKey) => reads.findExternalObject(idempotencyKey),
    },
    { name },
    key,
  );
  await sleep(1_000);
  const version = isPatchActive("p3-t02-replay-probe") ? "v2" : "v1";
  return `${version}:${created.outcome}:${created.result}`;
}
