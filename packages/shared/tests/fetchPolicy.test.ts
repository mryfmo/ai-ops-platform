/**
 * packages/shared/tests/fetchPolicy.test.ts
 * 根拠: DevOps SPEC-INT-080
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { withTimeout, type FetchLike } from "../src/clients/fetchPolicy.js";

describe("withTimeout [DevOps SPEC-INT-080]", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function useFakeNativeTimeout(): void {
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      const controller = new AbortController();
      setTimeout(
        () => controller.abort(new DOMException("The operation was aborted due to timeout", "TimeoutError")),
        ms,
      );
      return controller.signal;
    });
  }

  it("期限到達時にfetchをAbortErrorで中断する", async () => {
    vi.useFakeTimers();
    useFakeNativeTimeout();
    let signalReason: unknown;
    const fetchImpl: FetchLike = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            signalReason = init.signal?.reason;
            reject(init.signal?.reason);
          },
          { once: true },
        );
      });

    const pending = withTimeout(fetchImpl, 100)("https://example.test");
    const rejection = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(100);

    expect(signalReason).toMatchObject({ name: "TimeoutError" });
    await rejection;
  });

  it("呼び出し側のsignalも合成する", async () => {
    const controller = new AbortController();
    const callerReason = new Error("caller cancelled");
    const fetchImpl: FetchLike = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      });
    const pending = withTimeout(fetchImpl, 1_000)("https://example.test", { signal: controller.signal });
    controller.abort(callerReason);

    await expect(pending).rejects.toBe(callerReason);
  });

  it("callerより先にtimeoutした場合は後発callerの理由で上書きしない", async () => {
    vi.useFakeTimers();
    useFakeNativeTimeout();
    const controller = new AbortController();
    const fetchImpl: FetchLike = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      });
    const pending = withTimeout(fetchImpl, 100)("https://example.test", { signal: controller.signal });
    const rejection = expect(pending).rejects.toMatchObject({ name: "AbortError" });

    await vi.advanceTimersByTimeAsync(100);
    controller.abort(new Error("late caller"));

    await rejection;
  });
});
