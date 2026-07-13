/**
 * packages/shared/src/clients/fetchPolicy.ts
 *
 * 根拠: DevOps SPEC-INT-080 — GitHub/Graph API のタイムアウトと再試行ポリシー。
 */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number; // 既定30秒（SPEC-INT-080）
  maxDelayMs?: number; // 既定15分（SPEC-INT-080）
  /** Receives the exact total delay once; only the native implementation chunks long waits. */
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  /** GitHub secondary rate limit: valid Retry-After付き403のみ再試行する。 */
  retryForbiddenWithRetryAfter?: boolean;
}

export type RetryPolicy = "idempotent" | "non-idempotent";

const MAX_TIMEOUT_MS = 2_147_483_647;

async function sleep(ms: number): Promise<void> {
  let remaining = ms;
  while (remaining > MAX_TIMEOUT_MS) {
    await new Promise((resolve) => setTimeout(resolve, MAX_TIMEOUT_MS));
    remaining -= MAX_TIMEOUT_MS;
  }
  await new Promise((resolve) => setTimeout(resolve, remaining));
}

function jitter(ms: number, random: () => number): number {
  return ms * (0.8 + random() * 0.4);
}

/** 呼び出し元のsignalを保持しつつ、各HTTP試行へ期限を付ける。 */
export function withTimeout<TInput>(
  fetchImpl: (input: TInput, init?: RequestInit) => Promise<Response>,
  ms: number,
): (input: TInput, init?: RequestInit) => Promise<Response> {
  return (input, init = {}) => {
    const timeoutSignal = AbortSignal.timeout(ms);
    const callerSignal = init.signal;
    const signal = callerSignal ? AbortSignal.any([callerSignal, timeoutSignal]) : timeoutSignal;
    let abortSource: "caller" | "timeout" | undefined = callerSignal?.aborted ? "caller" : undefined;
    const onCallerAbort = () => (abortSource ??= "caller");
    const onTimeout = () => (abortSource ??= "timeout");
    callerSignal?.addEventListener("abort", onCallerAbort, { once: true });
    timeoutSignal.addEventListener("abort", onTimeout, { once: true });
    return fetchImpl(input, { ...init, signal })
      .catch((error: unknown) => {
        if (abortSource === "timeout") throw new DOMException("The operation was aborted due to timeout", "AbortError");
        throw error;
      })
      .finally(() => {
        callerSignal?.removeEventListener("abort", onCallerAbort);
        timeoutSignal.removeEventListener("abort", onTimeout);
      });
  };
}

/** 429/403 rate-limit・冪等5xxに対する指数バックオフ（初期30秒、最大15分）。 */
export async function fetchWithBackoff(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  opts: RetryOptions = {},
  policy: RetryPolicy = init.method?.toUpperCase() === "POST" ? "non-idempotent" : "idempotent",
): Promise<Response> {
  const maxRetries = opts.maxRetries ?? 5;
  const maxDelayMs = Math.max(0, opts.maxDelayMs ?? 15 * 60_000);
  const initialDelayMs = Math.min(Math.max(0, opts.initialDelayMs ?? 30_000), maxDelayMs);
  const wait = opts.sleep ?? sleep;
  const random = opts.random ?? Math.random;

  let attempt = 0;
  let delay = initialDelayMs;
  for (;;) {
    const res = await fetchImpl(url, init);
    const retryAfterHeader = res.headers.get("Retry-After");
    const normalizedRetryAfter = retryAfterHeader?.trim() ?? "";
    const retryAfterSeconds = /^\d+$/.test(normalizedRetryAfter) ? Number(normalizedRetryAfter) : Number.NaN;
    const validRetryAfter =
      Number.isSafeInteger(retryAfterSeconds) && retryAfterSeconds <= Number.MAX_SAFE_INTEGER / 1000;
    const rateLimited =
      res.status === 429 || (opts.retryForbiddenWithRetryAfter === true && res.status === 403 && validRetryAfter);
    const retryable = rateLimited || (policy === "idempotent" && res.status >= 500);
    if (!retryable || attempt >= maxRetries) return res;

    const waitMs = validRetryAfter ? retryAfterSeconds * 1000 : Math.min(jitter(delay, random), maxDelayMs);
    await wait(waitMs);
    delay = Math.min(delay * 2, maxDelayMs);
    attempt += 1;
  }
}
