/** 根拠: FinalArch:PRD-007 / FinalArch:FR-M365-001 / ADR-0024 */
import {
  WORKIQ_DELEGATED_SCOPE,
  WORKIQ_RESOURCE_AUDIENCE,
  validateWorkIqDelegatedClaims,
  type WorkIqDelegatedToken,
  type WorkIqDelegatedTokenProvider,
} from "@aiops/integrations";

export interface WorkIqOboExchangeInput {
  readonly userAssertion: string;
  readonly subject: string;
  readonly tenantId: string;
  readonly scopes: readonly [typeof WORKIQ_DELEGATED_SCOPE];
  readonly resourceAudience: typeof WORKIQ_RESOURCE_AUDIENCE;
}

export interface WorkIqOboExchangeResult {
  readonly accessToken: string;
  readonly claims: unknown;
  readonly expiresAtUnix: number;
}

export interface WorkIqOboExchange {
  exchange(input: WorkIqOboExchangeInput): Promise<WorkIqOboExchangeResult>;
}

interface CacheEntry {
  readonly token: WorkIqDelegatedToken;
  readonly cacheUntilUnix: number;
}

function cacheKey(input: WorkIqOboExchangeInput): string {
  return JSON.stringify([input.subject, input.tenantId, [...input.scopes].sort(), input.resourceAudience]);
}

export class WorkIqOboTokenCache {
  private readonly entries = new Map<string, CacheEntry>();

  get(input: WorkIqOboExchangeInput, nowUnix: number): WorkIqDelegatedToken | undefined {
    const key = cacheKey(input);
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.cacheUntilUnix <= nowUnix) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.token;
  }

  set(input: WorkIqOboExchangeInput, token: WorkIqDelegatedToken, cacheUntilUnix: number): void {
    this.entries.set(cacheKey(input), { token, cacheUntilUnix });
  }
}

export interface WorkIqOboTokenProviderOptions {
  readonly exchange: WorkIqOboExchange;
  readonly cache: WorkIqOboTokenCache;
  readonly userAssertion: string;
  readonly subject: string;
  readonly tenantId: string;
  readonly nowUnix?: () => number;
}

export function createWorkIqOboTokenProvider(options: WorkIqOboTokenProviderOptions): WorkIqDelegatedTokenProvider {
  const input: WorkIqOboExchangeInput = {
    userAssertion: options.userAssertion,
    subject: options.subject,
    tenantId: options.tenantId,
    scopes: [WORKIQ_DELEGATED_SCOPE],
    resourceAudience: WORKIQ_RESOURCE_AUDIENCE,
  };
  const nowUnix = options.nowUnix ?? (() => Math.floor(Date.now() / 1_000));

  return {
    async getToken() {
      const now = nowUnix();
      const cached = options.cache.get(input, now);
      if (cached) return cached;
      if (!/^\S+$/u.test(input.userAssertion)) throw new Error("E-M365-CLAIMS");

      const exchanged = await options.exchange.exchange(input);
      if (!/^\S+$/u.test(exchanged.accessToken) || !Number.isSafeInteger(exchanged.expiresAtUnix)) {
        throw new Error("E-M365-CLAIMS");
      }
      const claims = validateWorkIqDelegatedClaims(exchanged.claims, input.tenantId);
      if (claims.subject !== input.subject || exchanged.expiresAtUnix <= now) throw new Error("E-M365-CLAIMS");

      const token = { accessToken: exchanged.accessToken, claims } satisfies WorkIqDelegatedToken;
      const cacheUntilUnix = Math.min(exchanged.expiresAtUnix - 120, now + 300);
      if (cacheUntilUnix > now) options.cache.set(input, token, cacheUntilUnix);
      return token;
    },
  };
}
