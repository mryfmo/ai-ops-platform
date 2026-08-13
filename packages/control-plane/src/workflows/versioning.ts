// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / ADR-0020
// long-running workflow の code change 用 versioning ヘルパ（正典 component spec 01
// Workflow rules「Temporal versioning/pinned worker deploymentを使う」）。
// patch ID を命名規約で拘束した @temporalio/workflow patched/deprecatePatch の薄い wrapper。

import { deprecatePatch, patched } from "@temporalio/workflow";

/** patch ID は "<task-id>-<短い説明>" の kebab-case（例: p3-t04-dispatch-v2）。 */
const PATCH_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/u;

function assertPatchId(patchId: string): void {
  if (!PATCH_ID_PATTERN.test(patchId)) {
    throw new RangeError(`patch ID must match ${PATCH_ID_PATTERN.source} (got ${JSON.stringify(patchId)})`);
  }
}

/**
 * 新旧 code path の分岐。新 history では true、旧 history の replay では false を返す
 * （Temporal patched のセマンティクスそのまま。決定性は SDK が保証）。
 */
export function isPatchActive(patchId: string): boolean {
  assertPatchId(patchId);
  return patched(patchId);
}

/** 旧 path を退役させる際に呼ぶ。全稼働 history が新 path になった後のみ使用。 */
export function retirePatch(patchId: string): void {
  assertPatchId(patchId);
  deprecatePatch(patchId);
}
