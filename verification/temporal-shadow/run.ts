// 根拠: FinalArch:FR-CP-008 / TMP-003 / ADR-0021 / DELTA-01
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  FIXED_SHADOW_CLOCK_MS,
  LEGACY_TASK_SOURCE_PATHS,
  assertPlanOnlyBundle,
  assertPlanOnlySource,
  assertReadOnlyProcess,
  runTemporalShadowComparison,
  type LegacyTaskSources,
} from "./shadow.js";

const repoRoot = process.cwd();
const source = (relativePath: string): string => readFileSync(path.join(repoRoot, relativePath), "utf8");
const harnessSource = source("verification/temporal-shadow/shadow.ts");
const runnerSource = source("verification/temporal-shadow/run.ts");
const legacyTaskSources = Object.fromEntries(
  Object.entries(LEGACY_TASK_SOURCE_PATHS).map(([registration, sourcePath]) => [registration, source(sourcePath)]),
) as LegacyTaskSources;

assertReadOnlyProcess();
assertPlanOnlySource(harnessSource);
assertPlanOnlySource(runnerSource, ["node:fs", "node:path", "./shadow.js"]);
assertPlanOnlyBundle(readFileSync(process.argv[1], "utf8"));
const result = runTemporalShadowComparison({
  observedAtMs: FIXED_SHADOW_CLOCK_MS,
  schedulerSource: source("packages/server/src/index.ts"),
  legacyTaskSources,
  prjopsJobPolicySource: source("packages/server/src/lib/prjopsJobPolicy.ts"),
  reportDeliveryWorkflowSource: source("packages/control-plane/src/workflows/reportDelivery.ts"),
  planeSyncWorkflowSource: source("packages/control-plane/src/workflows/planeSync.ts"),
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
