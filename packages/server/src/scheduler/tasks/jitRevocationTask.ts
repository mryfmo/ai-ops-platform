/**
 * packages/server/src/scheduler/tasks/jitRevocationTask.ts
 *
 * 根拠: DevOps:SPEC-INT-032 / TH-007（JIT権限の毎分失効判定。本番8時間・開発/STG 30日・外部90日）。
 *   失効はフェイルセーフ中も継続する「安全側操作」（REQ-029, AGT_ORCH.isOperationAllowedDuringFailsafe）。
 *   判定・剥奪は既存 AGT_SEC.revokeExpiredGrants を使用し、本タスクは台帳の読込と結果反映のみ担う
 *   （ADR-0003で未実装だった毎分ループの初の実装）。
 */
import { revokeExpiredGrants, type SecDependencies } from "@aiops/devops";
import type { ScheduledTask } from "../scheduler.js";
import type { GrantsRepo } from "../../db/grantsRepo.js";

export interface JitRevocationTaskDeps {
  grantsRepo: GrantsRepo;
  secDeps: Omit<SecDependencies, "traceId">;
  traceIdProvider(): string;
}

export function createJitRevocationTask(deps: JitRevocationTaskDeps): ScheduledTask {
  return {
    name: "jit-revocation-1m",
    intervalMs: 60_000,
    async run(now: Date): Promise<void> {
      const grants = await deps.grantsRepo.loadActiveGrants();
      if (grants.length === 0) return;
      const revoked = await revokeExpiredGrants(grants, now, {
        ...deps.secDeps,
        traceId: deps.traceIdProvider(),
      });
      await deps.grantsRepo.markRevoked(revoked, now);
    },
  };
}
