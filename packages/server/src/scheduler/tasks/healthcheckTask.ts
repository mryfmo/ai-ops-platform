/**
 * packages/server/src/scheduler/tasks/healthcheckTask.ts
 *
 * 根拠: DevOps SPEC-INT-040（AGT-ORCHヘルスチェック30秒間隔）/ REQ-029（3回連続不応答で
 *   フェイルセーフ発動。許可操作=権限失効・通知送信のみ、禁止=自動デプロイ・自動クローズ・権限付与）。
 *   判定は既存純粋関数 AGT_ORCH.evaluateFailsafe を使用（本タスクはADR-0003で未実装だった
 *   呼び出しループの初の実装）。
 */
import { evaluateFailsafe, type HealthCheckState } from "@aiops/devops";
import type { AuditLogWriter } from "@aiops/shared";
import type { ScheduledTask } from "../scheduler.js";

export interface HealthcheckTaskDeps {
  /** 監視対象（DB接続・下流エージェント等）の生存確認。falseまたは例外で失敗1回と数える */
  checkTargets(): Promise<boolean>;
  /** フェイルセーフ発動時の処理（全プロジェクトチャネルへの通知等 SPEC-EXT-042）。冪等であること */
  activateFailsafe(): Promise<void>;
  /** フェイルセーフ状態の照会/解除に使う共有状態ストア */
  isFailsafeActive(): boolean;
  setFailsafeActive(active: boolean): void;
  auditLog: AuditLogWriter;
  traceIdProvider(): string;
}

export function createHealthcheckTask(deps: HealthcheckTaskDeps): ScheduledTask {
  const state: HealthCheckState = { consecutiveFailures: 0 };

  return {
    name: "healthcheck-30s",
    intervalMs: 30_000,
    async run(now: Date): Promise<void> {
      let healthy = false;
      try {
        healthy = await deps.checkTargets();
      } catch {
        healthy = false;
      }

      if (healthy) {
        const wasFailing = state.consecutiveFailures >= 3;
        state.consecutiveFailures = 0;
        if (wasFailing && deps.isFailsafeActive()) {
          // 回復: フェイルセーフ解除を監査ログへ（自動再開の可否は運用判断のため、状態のみ更新）
          deps.setFailsafeActive(false);
          await deps.auditLog.append({
            trace_id: deps.traceIdProvider(),
            actor: "AGT-ORCH",
            action: "failsafe_recovered",
            basis: "REQ-029",
            detail: { at: now.toISOString() },
            at: now.toISOString(),
          });
        }
        return;
      }

      state.consecutiveFailures += 1;
      if (evaluateFailsafe(state) === "activate_failsafe" && !deps.isFailsafeActive()) {
        deps.setFailsafeActive(true);
        await deps.auditLog.append({
          trace_id: deps.traceIdProvider(),
          actor: "AGT-ORCH",
          action: "failsafe_activated",
          basis: "REQ-029",
          detail: { consecutiveFailures: state.consecutiveFailures },
          at: now.toISOString(),
        });
        await deps.activateFailsafe();
      }
    },
  };
}
