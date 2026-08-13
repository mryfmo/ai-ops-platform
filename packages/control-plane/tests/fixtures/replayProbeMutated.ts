// 根拠: FinalArch:FR-CP-001 / ADR-0020
// replay.test.ts の負 fixture: recorded history と構造が食い違う workflow。
// timer を先頭に挿入しており、executed history の replay は nondeterminism になる。

import { sleep } from "@temporalio/workflow";

export async function replayProbeWorkflow(name: string): Promise<string> {
  await sleep(5_000);
  return `mutated:${name}`;
}
