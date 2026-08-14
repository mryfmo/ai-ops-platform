// 根拠: FinalArch:FR-CP-008 / TMP-003 / ADR-0021 / DELTA-01
import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildSync } from "esbuild";
import { describe, expect, it } from "vitest";

import {
  EXPECTED_SCHEDULER_REGISTRATIONS,
  FIXED_SHADOW_CLOCK_MS,
  LEGACY_TASK_SOURCE_PATHS,
  SHADOW_LEGACY_CONDITIONS,
  assertPlanOnlyBundle,
  assertPlanOnlySource,
  compareSchedulerInventory,
  extractSchedulerRegistrations,
  runTemporalShadowComparison,
  type LegacyTaskSources,
} from "../../../verification/temporal-shadow/shadow.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const source = (relativePath: string): string => readFileSync(path.join(repoRoot, relativePath), "utf8");
const legacyTaskSources = Object.fromEntries(
  Object.entries(LEGACY_TASK_SOURCE_PATHS).map(([registration, sourcePath]) => [registration, source(sourcePath)]),
) as LegacyTaskSources;
const shadowInput = (
  schedulerSource = source("packages/server/src/index.ts"),
  taskSources: LegacyTaskSources = legacyTaskSources,
) => ({
  observedAtMs: FIXED_SHADOW_CLOCK_MS,
  schedulerSource,
  legacyTaskSources: taskSources,
  prjopsJobPolicySource: source("packages/server/src/lib/prjopsJobPolicy.ts"),
  reportDeliveryWorkflowSource: source("packages/control-plane/src/workflows/reportDelivery.ts"),
  planeSyncWorkflowSource: source("packages/control-plane/src/workflows/planeSync.ts"),
});

describe("FinalArch:FR-CP-008 / DELTA-01 Temporal scheduler shadow", () => {
  it("index.ts の scheduler inventory 15件を順序込みで完全に捕捉する", () => {
    const schedulerSource = source("packages/server/src/index.ts");
    const registrations = extractSchedulerRegistrations(schedulerSource, SHADOW_LEGACY_CONDITIONS);

    expect(registrations).toEqual(EXPECTED_SCHEDULER_REGISTRATIONS);
    expect(registrations).toHaveLength(15);
    expect(extractSchedulerRegistrations(schedulerSource, { githubPolicyEnabled: false })).toEqual(
      EXPECTED_SCHEDULER_REGISTRATIONS.filter((registration) => registration !== "createJitRevocationTask"),
    );
  });

  it("P3-T10-002: cutover wrapper の欠落・二重・鍵不一致・鍵重複・非 literal を fail-closed で拒否する", () => {
    const synth = (elements: string) => `startScheduler([${elements}], () => {});`;
    const ok = 'observedTask(cutover("createHealthcheckTask", createHealthcheckTask({})))';
    expect(extractSchedulerRegistrations(synth(ok), SHADOW_LEGACY_CONDITIONS)).toEqual(["createHealthcheckTask"]);
    expect(() =>
      extractSchedulerRegistrations(synth("observedTask(createHealthcheckTask({}))"), SHADOW_LEGACY_CONDITIONS),
    ).toThrow(/exactly one cutover wrapper; found=0/u);
    expect(() =>
      extractSchedulerRegistrations(
        synth('cutover("createHealthcheckTask", cutover("createHealthcheckTask", createHealthcheckTask({})))'),
        SHADOW_LEGACY_CONDITIONS,
      ),
    ).toThrow(/exactly one cutover wrapper; found=2/u);
    expect(() =>
      extractSchedulerRegistrations(
        synth('observedTask(cutover("createReportDeliveryTask", createHealthcheckTask({})))'),
        SHADOW_LEGACY_CONDITIONS,
      ),
    ).toThrow(/does not match the registered task/u);
    expect(() => extractSchedulerRegistrations(synth(`${ok}, ${ok}`), SHADOW_LEGACY_CONDITIONS)).toThrow(
      /duplicate cutover registration key/u,
    );
    expect(() =>
      extractSchedulerRegistrations(
        synth("observedTask(cutover(name, createHealthcheckTask({})))"),
        SHADOW_LEGACY_CONDITIONS,
      ),
    ).toThrow(/string literal registration key/u);
    // 実ソース経路: healthcheck の wrapper 鍵だけを別 task 名へ差し替えると拒否される。
    const schedulerSource = source("packages/server/src/index.ts");
    const wrongKey = schedulerSource.replace(
      /cutover\(\s*"createHealthcheckTask",/u,
      'cutover("createReportDeliveryTask",',
    );
    expect(wrongKey).not.toBe(schedulerSource);
    expect(() => extractSchedulerRegistrations(wrongKey, SHADOW_LEGACY_CONDITIONS)).toThrow(
      /does not match the registered task/u,
    );
  });

  it("scheduler task の追加・欠落を fail-closed で拒否する", () => {
    expect(() =>
      compareSchedulerInventory(EXPECTED_SCHEDULER_REGISTRATIONS.slice(1), EXPECTED_SCHEDULER_REGISTRATIONS),
    ).toThrow(/missing.*createHealthcheckTask/u);
    expect(() =>
      compareSchedulerInventory(
        [...EXPECTED_SCHEDULER_REGISTRATIONS, "createFutureTask"],
        EXPECTED_SCHEDULER_REGISTRATIONS,
      ),
    ).toThrow(/unexpected.*createFutureTask/u);

    const schedulerSource = source("packages/server/src/index.ts");
    const unknownEntry = schedulerSource.replace(
      "startScheduler(\n        [",
      "startScheduler(\n        [\n          futureTask,",
    );
    expect(unknownEntry).not.toBe(schedulerSource);
    expect(() => extractSchedulerRegistrations(unknownEntry, SHADOW_LEGACY_CONDITIONS)).toThrow(
      /exactly one recognized task/u,
    );
    const secondScheduler = `startScheduler([{ name: "future-task", intervalMs: 1, async run() {} }], () => {});\n${schedulerSource}`;
    expect(() => extractSchedulerRegistrations(secondScheduler, SHADOW_LEGACY_CONDITIONS)).toThrow(
      /exactly one startScheduler/u,
    );

    const changedInlineAction = schedulerSource.replace(
      "                await refreshSubscriptionPresence();\n                publishCapabilities();",
      "              void now;",
    );
    expect(changedInlineAction).not.toBe(schedulerSource);
    expect(() => runTemporalShadowComparison(shadowInput(changedInlineAction))).toThrow(/legacy action call mismatch/u);

    const changedInterval = schedulerSource.replace(
      'name: "capability-metrics-refresh-30s",\n              intervalMs: 30_000',
      'name: "capability-metrics-refresh-30s",\n              intervalMs: 999_000',
    );
    expect(changedInterval).not.toBe(schedulerSource);
    expect(() => runTemporalShadowComparison(shadowInput(changedInterval))).toThrow(/unreasoned plan difference/u);

    const changedFactoryOverride = schedulerSource.replace(
      "createPmSnapshotReconcileTask({\n                  repo:",
      "createPmSnapshotReconcileTask({\n                  intervalMs: 123_000,\n                  repo:",
    );
    expect(changedFactoryOverride).not.toBe(schedulerSource);
    expect(() => runTemporalShadowComparison(shadowInput(changedFactoryOverride))).toThrow(
      /unreasoned plan difference/u,
    );

    const retimedRunOnStart = {
      ...legacyTaskSources,
      createApprovedDeployTask: legacyTaskSources.createApprovedDeployTask.replace(
        "intervalMs: 30_000",
        "intervalMs: 999_000",
      ),
    };
    expect(retimedRunOnStart.createApprovedDeployTask).not.toBe(legacyTaskSources.createApprovedDeployTask);
    expect(() => runTemporalShadowComparison(shadowInput(schedulerSource, retimedRunOnStart))).toThrow(
      /unreasoned plan difference/u,
    );

    const unrelatedReasonedRetiming = {
      ...legacyTaskSources,
      createChannelPollingTask: legacyTaskSources.createChannelPollingTask.replace("5 * 60_000", "6 * 60_000"),
    };
    expect(unrelatedReasonedRetiming.createChannelPollingTask).not.toBe(legacyTaskSources.createChannelPollingTask);
    expect(() => runTemporalShadowComparison(shadowInput(schedulerSource, unrelatedReasonedRetiming))).toThrow(
      /unreasoned plan difference/u,
    );

    const changedLegacyAction = {
      ...legacyTaskSources,
      createJitRevocationTask: legacyTaskSources.createJitRevocationTask.replace(
        "await deps.grantsRepo.markRevoked(revoked, now);",
        "void revoked;",
      ),
    };
    expect(changedLegacyAction.createJitRevocationTask).not.toBe(legacyTaskSources.createJitRevocationTask);
    expect(() => runTemporalShadowComparison(shadowInput(schedulerSource, changedLegacyAction))).toThrow(
      /legacy action call mismatch/u,
    );

    const duplicatedLegacyAction = {
      ...legacyTaskSources,
      createApprovedDeployTask: legacyTaskSources.createApprovedDeployTask.replace(
        "await deps.execute(target.owner, target.repo, target.commitSha, traceId);",
        "await deps.execute(target.owner, target.repo, target.commitSha, traceId);\n        await deps.execute(target.owner, target.repo, target.commitSha, traceId);",
      ),
    };
    expect(duplicatedLegacyAction.createApprovedDeployTask).not.toBe(legacyTaskSources.createApprovedDeployTask);
    expect(() => runTemporalShadowComparison(shadowInput(schedulerSource, duplicatedLegacyAction))).toThrow(
      /legacy action call mismatch/u,
    );

    const addedDependencyWrite = {
      ...legacyTaskSources,
      createJitRevocationTask: legacyTaskSources.createJitRevocationTask.replace(
        "await deps.grantsRepo.markRevoked(revoked, now);",
        "await deps.grantsRepo.markRevoked(revoked, now);\n        await deps.auditRepo.insert(revoked);",
      ),
    };
    expect(addedDependencyWrite.createJitRevocationTask).not.toBe(legacyTaskSources.createJitRevocationTask);
    expect(() => runTemporalShadowComparison(shadowInput(schedulerSource, addedDependencyWrite))).toThrow(
      /legacy call inventory mismatch/u,
    );

    const addedHelperWrite = {
      ...legacyTaskSources,
      createJitRevocationTask: legacyTaskSources.createJitRevocationTask.replace(
        "await deps.grantsRepo.markRevoked(revoked, now);",
        "await deps.grantsRepo.markRevoked(revoked, now);\n        await sendWebhook(revoked);",
      ),
    };
    expect(addedHelperWrite.createJitRevocationTask).not.toBe(legacyTaskSources.createJitRevocationTask);
    expect(() => runTemporalShadowComparison(shadowInput(schedulerSource, addedHelperWrite))).toThrow(
      /legacy call inventory mismatch/u,
    );

    expect(() =>
      runTemporalShadowComparison({
        ...shadowInput(),
        reportDeliveryWorkflowSource: "export async function reportDeliveryWorkflow() {}",
      }),
    ).toThrow(/workflow structure mismatch/u);
    expect(() =>
      runTemporalShadowComparison({
        ...shadowInput(),
        planeSyncWorkflowSource: "export async function planeSyncWorkflow() {}",
      }),
    ).toThrow(/workflow structure mismatch/u);
    expect(() =>
      runTemporalShadowComparison({
        ...shadowInput(),
        reportDeliveryWorkflowSource: source("packages/control-plane/src/workflows/reportDelivery.ts").replace(
          "assertReportDeliveryRequest(input);",
          "assertReportDeliveryRequest(input);\n    externalWrites.sendSomething();",
        ),
      }),
    ).toThrow(/workflow structure mismatch/u);

    expect(() =>
      runTemporalShadowComparison({
        ...shadowInput(),
        prjopsJobPolicySource: source("packages/server/src/lib/prjopsJobPolicy.ts").replace('"06:00"', '"07:00"'),
      }),
    ).toThrow(/guard predicate changed/u);
  }, 120_000);

  it("15件の planned action/time を一致または根拠付き差分として記録する", () => {
    const result = runTemporalShadowComparison(shadowInput());

    expect(result.inventory).toEqual({
      expected: 15,
      observed: 15,
      complete: true,
      conditions: { githubPolicyEnabled: true },
    });
    expect(result.comparisons).toHaveLength(15);
    expect(result.comparisons.every((row) => row.status === "match" || Boolean(row.reason))).toBe(true);
    expect(result.comparisons.every((row) => row.legacy.everyMs > 0 && row.temporal.everyMs > 0)).toBe(true);
    expect(result.comparisons.find(({ task }) => task === "healthcheck")?.temporal).toEqual(
      expect.objectContaining({ action: "health.evaluate", target: "healthEvaluationWorkflow", everyMs: 30_000 }),
    );
    expect(result.comparisons.find(({ task }) => task === "subscription-renewal")?.temporal).toEqual(
      expect.objectContaining({
        action: "graph.subscription.renew",
        target: "graphSubscriptionWorkflow:renewal",
        everyMs: 237_300_000,
      }),
    );
    expect(result.comparisons.find(({ task }) => task === "approved-deploy")).toEqual(
      expect.objectContaining({
        status: "reasoned-difference",
        legacy: expect.objectContaining({ recurrenceAnchor: "startup-completion" }),
        temporal: expect.objectContaining({ recurrenceAnchor: "fixed-observed-at" }),
      }),
    );
    expect(result.summary).toEqual({
      matches: 12,
      reasonedDifferences: 3,
      unreasonedDifferences: 0,
      temporalOnlyPlans: 1,
    });
    expect(result.temporalOnlyPlans).toEqual([
      expect.objectContaining({
        action: "graph.subscription.reconcile",
        target: "graphSubscriptionWorkflow:reconcile",
        plannedAt: "2026-05-31T15:04:00.000Z",
      }),
    ]);
    expect(result.temporalDefinitions).toEqual({
      p3t05GraphSubscriptionSchedules: true,
      p3t06JitHealthSchedules: true,
      p3t07ReportDeliveryWorkflow: true,
      p3t08PlaneSyncWorkflow: true,
      p3t08HasLegacySchedulerCounterpart: false,
    });
    expect(result.guardedActionBasis).toEqual({
      holidayCalendar: "empty-deterministic",
      sevenKeysMonthlySnapshotAt: "2026-06-01T14:59:00.000Z",
      prjopsWeeklyAnalyzeAt: "2026-05-31T21:00:00.000Z",
      prjopsDailyTrackerAt: "2026-06-01T00:00:00.000Z",
      reportDeliveryAt: "2026-06-01T14:59:00.000Z",
    });
    expect(JSON.parse(source("verification/temporal-shadow/shadow-evidence.json"))).toEqual(result);
  });

  it("TMP-003 shadow は plan-only で外部 write capability を持たない", () => {
    const harnessSource = source("verification/temporal-shadow/shadow.ts");
    assertPlanOnlySource(harnessSource);

    const result = runTemporalShadowComparison(shadowInput());
    expect(result.externalWrites).toBe(0);
    expect(result.sideEffectMode).toBe("structural-plan-only");
    expect(() => assertPlanOnlySource("fetch('https://example.invalid')")).toThrow(/side-effect capability/u);
    expect(() => assertPlanOnlySource('import { writeFileSync } from "node:fs"; writeFileSync("x", "x")')).toThrow(
      /side-effect capability/u,
    );

    const bundleDir = realpathSync(mkdtempSync(path.join(os.tmpdir(), "p3t09-shadow-")));
    try {
      const bundlePath = path.join(bundleDir, "run.cjs");
      buildSync({
        entryPoints: [path.join(repoRoot, "verification/temporal-shadow/run.ts")],
        bundle: true,
        platform: "node",
        format: "cjs",
        outfile: bundlePath,
        logLevel: "silent",
      });
      const bundleSource = readFileSync(bundlePath, "utf8");
      assertPlanOnlyBundle(bundleSource);
      expect(() => assertPlanOnlyBundle('require("node:http")')).toThrow(/network capability/u);
      expect(() => assertPlanOnlyBundle('require("node:dns/promises")')).toThrow(/network capability/u);
      const restrictedOutput = execFileSync(
        process.execPath,
        [
          "--permission",
          `--allow-fs-read=${repoRoot}`,
          `--allow-fs-read=${bundleDir}`,
          `--import=${path.join(repoRoot, "verification/temporal-shadow/deny-network.mjs")}`,
          bundlePath,
        ],
        { cwd: repoRoot, encoding: "utf8" },
      );
      expect(JSON.parse(restrictedOutput)).toEqual(result);
      expect(() =>
        execFileSync(
          process.execPath,
          [
            "--permission",
            `--allow-fs-read=${repoRoot}`,
            `--import=${path.join(repoRoot, "verification/temporal-shadow/deny-network.mjs")}`,
            "-e",
            'fetch("https://example.invalid")',
          ],
          { cwd: repoRoot, stdio: "pipe" },
        ),
      ).toThrow(/network access denied/u);
      expect(() =>
        execFileSync(
          process.execPath,
          [
            "--permission",
            `--allow-fs-read=${repoRoot}`,
            `--import=${path.join(repoRoot, "verification/temporal-shadow/deny-network.mjs")}`,
            "-e",
            'require("node:dns/promises").resolve("example.invalid")',
          ],
          { cwd: repoRoot, stdio: "pipe" },
        ),
      ).toThrow(/network access denied/u);
    } finally {
      rmSync(bundleDir, { recursive: true, force: true });
    }
  });
});
