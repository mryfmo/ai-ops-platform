// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / ADR-0020
// TMP-003「External side effects are idempotent」の lost-response retry test。
// 応答喪失後に再実行せず reconcile で回収し、外部 object を二重作成しないこと。

import { describe, expect, it, vi } from "vitest";

import {
  ExternalSideEffectUnresolvedError,
  runExternalSideEffect,
  type ExternalSideEffectPorts,
} from "../src/workflows/sideEffect.js";

function ports(overrides: Partial<ExternalSideEffectPorts<string, string>>): {
  ports: ExternalSideEffectPorts<string, string>;
  execute: ReturnType<typeof vi.fn>;
  reconcile: ReturnType<typeof vi.fn>;
} {
  const execute = vi.fn(overrides.execute ?? (async (input: string) => `created:${input}`));
  const reconcile = vi.fn(overrides.reconcile ?? (async () => null));
  return { ports: { execute, reconcile }, execute, reconcile };
}

describe("TMP-003 非冪等外部書き込みは single-attempt + reconcile", () => {
  it("成功時は executed を返し reconcile は呼ばない", async () => {
    const { ports: p, execute, reconcile } = ports({});
    const outcome = await runExternalSideEffect(p, "obj", "wf#create#0");
    expect(outcome).toEqual({ outcome: "executed", result: "created:obj" });
    expect(execute).toHaveBeenCalledExactlyOnceWith("obj", "wf#create#0");
    expect(reconcile).not.toHaveBeenCalled();
  });

  it("lost-response: 書き込みは成立したが応答が失われた場合、再実行せず reconcile で回収する（二重作成なし）", async () => {
    const externallyCreated: string[] = [];
    const { ports: p, execute } = ports({
      execute: async (input: string, key: string) => {
        externallyCreated.push(`${key}:${input}`);
        throw new Error("connection reset before response");
      },
      reconcile: async (key: string) => externallyCreated.find((k) => k.startsWith(key)) ?? null,
    });
    const outcome = await runExternalSideEffect(p, "obj", "wf#create#0");
    expect(outcome.outcome).toBe("reconciled");
    expect(execute).toHaveBeenCalledTimes(1);
    expect(externallyCreated).toHaveLength(1);
  });

  it("実行失敗かつ reconcile でも不在なら盲目的再実行はせず UnresolvedError（原因保持）", async () => {
    const cause = new Error("timeout");
    const { ports: p, execute } = ports({
      execute: async () => {
        throw cause;
      },
    });
    const error = await runExternalSideEffect(p, "obj", "wf#create#0").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ExternalSideEffectUnresolvedError);
    expect((error as ExternalSideEffectUnresolvedError).idempotencyKey).toBe("wf#create#0");
    expect((error as ExternalSideEffectUnresolvedError).cause).toBe(cause);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
