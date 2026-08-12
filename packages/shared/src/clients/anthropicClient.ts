/**
 * packages/shared/src/clients/anthropicClient.ts
 *
 * 根拠:
 *   - PrjOps:SPEC-INT-001: LLMを使う処理は (a)自由文の構造化(AGT-02) (b)レポート要約文生成(AGT-04)
 *     (c)重要度引き上げ提案の理由文生成(AGT-03) の3つに限定。既定モデル claude-sonnet-4-6、
 *     (a)で3回連続構造化失敗時のみ claude-opus-4-8 に昇格して1回再試行。
 *   - PrjOps:SPEC-INT-030: LLM構造化は温度0、スキーマへのJSON出力を強制。1件あたりLLM呼び出しは最大2回。
 *   - DevOps:SPEC-INT-011/030/031/033: 分類・要約はClaude API（構造化JSON出力）。
 *   - DevOps:SPEC-INT-070: LLMへの入力からシークレットパターンを除去するサニタイザを共通ライブラリとして実装。
 *   - PrjOps:REQ-035 データ所在: 外部送信されるデータは Anthropic API・Microsoft Graph・GitHub に限定する
 *     （外部通信allowlist: api.anthropic.com, graph.microsoft.com, github.com/api.github.com のみ。
 *     PrjOps:SPEC-INT-060）。
 *   - FinalArch:LLM-001 / FinalArch:LLM-004 / ADR-0022（P2-T05）: inference は LiteLLM gateway の
 *     logical alias 経由が正。本クライアントの transport は注入された gateway baseURL
 *     （private な LiteLLM endpoint）を既定とし、api.anthropic.com への direct mode は
 *     移行期の明示フラグ（allowDirectModeMigration）の背後にのみ残す。egress の最終遮断は
 *     P2-T07 cutover が正典（このファイルは構成時 fail-closed を担う）。
 *
 * 実装方式: Anthropic Messages APIの「ツール強制（tool_choice: {type: "tool", name}）」パターンで
 * 構造化JSON出力を保証する。これはAnthropic公式SDK（@anthropic-ai/sdk）が現在サポートする
 * 最も確実な決定的構造化出力の方法であり（自由文からのJSON抽出よりパース失敗率が低い）、
 * 出力は呼び出し側のzodスキーマで再検証してから使用する（二重検証によりE-ING03/LLM出力スキーマ不適合を防ぐ）。
 */
import Anthropic from "@anthropic-ai/sdk";
import { sanitizeForLlmInput, sanitizeSecrets } from "../secretSanitizer.js";
import type { AuditLogWriter } from "../auditLog.js";
import type { FetchLike } from "./fetchPolicy.js";

export const MAX_MODEL_ID_LENGTH = 200;
const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export interface LlmUsageRecord {
  at: string;
  agent: string;
  purpose: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  estimated_cost_usd: number;
}

export interface CostGuard {
  /** 本日すでに記録済みの合計コスト(USD)を返す */
  getTodaySpendUsd(): Promise<number>;
  /** 利用実績を記録する（audit/llm_usage.jsonl相当） */
  record(usage: LlmUsageRecord): Promise<void>;
  /** 呼び出し前に見積コストを予約する */
  reserve(usage: LlmUsageRecord): Promise<string>;
  /** 予約済み行を実コストへ照合する */
  reconcileReservation(reservationId: string, usage: LlmUsageRecord): Promise<void>;
  /** 日次上限（既定 $20。PrjOps:SPEC-INT-060。PRF-03が設定ファイルで変更可） */
  dailyLimitUsd: number;
}

export class InMemoryCostGuard implements CostGuard {
  private spend = 0;
  private records: LlmUsageRecord[] = [];
  constructor(public dailyLimitUsd: number = 20) {}
  async getTodaySpendUsd(): Promise<number> {
    return this.spend;
  }
  async record(usage: LlmUsageRecord): Promise<void> {
    this.spend += usage.estimated_cost_usd;
    this.records.push(usage);
  }
  async reserve(usage: LlmUsageRecord): Promise<string> {
    if (this.spend + usage.estimated_cost_usd > this.dailyLimitUsd) {
      throw new DailyCostLimitExceededError(this.spend + usage.estimated_cost_usd, this.dailyLimitUsd);
    }
    await this.record(usage);
    return String(this.records.length - 1);
  }
  async reconcileReservation(reservationId: string, usage: LlmUsageRecord): Promise<void> {
    const index = Number(reservationId);
    const previous = this.records[index];
    if (!previous) return;
    this.spend += usage.estimated_cost_usd - previous.estimated_cost_usd;
    this.records[index] = usage;
  }
  getRecords(): LlmUsageRecord[] {
    return [...this.records];
  }
}

// 2026-07時点の標準価格（開発環境表 DEV-04 / 運用環境表 OPS-01 に基づく。$/百万トークン）
export interface ModelPriceUsdPerMtok {
  readonly input: number;
  readonly output: number;
}
export type ModelPricingUsdPerMtok = Readonly<Record<string, ModelPriceUsdPerMtok>>;
export const MAX_PRICING_MODEL_COUNT = 100;
export const MAX_PRICING_JSON_BYTES = 64 * 1024;

export function validateModelId(value: unknown, field = "model"): string {
  if (typeof value !== "string") throw new Error(`E-CFG03: ${field} must be a string`);
  const model = value.trim();
  if (model.length === 0 || model.length > MAX_MODEL_ID_LENGTH || !MODEL_ID_PATTERN.test(model)) {
    throw new Error(`E-CFG03: ${field} is not a valid model ID`);
  }
  return model;
}

export function validateModelPricingUsdPerMtok(value: unknown): ModelPricingUsdPerMtok {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("E-CFG03: LLM pricing table must be a non-empty object");
  }
  const entries = Object.entries(value);
  if (entries.length === 0) throw new Error("E-CFG03: LLM pricing table must not be empty");
  if (entries.length > MAX_PRICING_MODEL_COUNT) {
    throw new Error(`E-CFG03: LLM pricing table must contain at most ${MAX_PRICING_MODEL_COUNT} models`);
  }
  return Object.freeze(
    Object.fromEntries(
      entries.map(([rawModel, rawPrice]) => {
        const model = validateModelId(rawModel, "pricing model");
        if (model !== rawModel) throw new Error("E-CFG03: pricing model IDs must not contain surrounding whitespace");
        if (!rawPrice || typeof rawPrice !== "object" || Array.isArray(rawPrice)) {
          throw new Error(`E-CFG03: pricing for ${model} must contain input and output`);
        }
        const keys = Object.keys(rawPrice);
        if (keys.length !== 2 || !keys.includes("input") || !keys.includes("output")) {
          throw new Error(`E-CFG03: pricing for ${model} must contain only input and output`);
        }
        const { input, output } = rawPrice as Record<string, unknown>;
        if (typeof input !== "number" || !Number.isFinite(input) || input <= 0) {
          throw new Error(`E-CFG03: input pricing for ${model} must be finite and positive`);
        }
        if (typeof output !== "number" || !Number.isFinite(output) || output <= 0) {
          throw new Error(`E-CFG03: output pricing for ${model} must be finite and positive`);
        }
        return [model, Object.freeze({ input, output })];
      }),
    ),
  );
}

function assertNoDuplicateJsonKeys(raw: string): void {
  const stack: Array<{ kind: "object"; keys: Set<string>; expectingKey: boolean } | { kind: "array" }> = [];
  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];
    if (char === '"') {
      const start = i;
      for (i += 1; i < raw.length; i += 1) {
        if (raw[i] === "\\") i += 1;
        else if (raw[i] === '"') break;
      }
      const current = stack.at(-1);
      if (current?.kind === "object" && current.expectingKey) {
        const key = JSON.parse(raw.slice(start, i + 1)) as string;
        if (current.keys.has(key)) throw new Error(`E-CFG03: duplicate pricing JSON key: ${key}`);
        current.keys.add(key);
        current.expectingKey = false;
      }
    } else if (char === "{") {
      stack.push({ kind: "object", keys: new Set(), expectingKey: true });
    } else if (char === "[") {
      stack.push({ kind: "array" });
    } else if (char === "}" || char === "]") {
      stack.pop();
    } else if (char === ",") {
      const current = stack.at(-1);
      if (current?.kind === "object") current.expectingKey = true;
    }
  }
}

const DEFAULT_PRICING_USD_PER_MTOK = validateModelPricingUsdPerMtok({
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
});
export const PRICING_USD_PER_MTOK = DEFAULT_PRICING_USD_PER_MTOK;

export function parseModelPricingUsdPerMtokJson(raw: string | undefined): ModelPricingUsdPerMtok {
  if (raw === undefined) return DEFAULT_PRICING_USD_PER_MTOK;
  if (raw.length > MAX_PRICING_JSON_BYTES || new TextEncoder().encode(raw).byteLength > MAX_PRICING_JSON_BYTES) {
    throw new Error(`E-CFG03: ANTHROPIC_PRICING_USD_PER_MTOK must be at most ${MAX_PRICING_JSON_BYTES} bytes`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
    assertNoDuplicateJsonKeys(raw);
  } catch {
    throw new Error("E-CFG03: ANTHROPIC_PRICING_USD_PER_MTOK must be valid JSON with unique keys");
  }
  return validateModelPricingUsdPerMtok(parsed);
}

function validateTokenCount(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`E-COST02: ${field} must be a safe non-negative integer`);
  }
}

export function resolveModelPrice(model: string, pricing: ModelPricingUsdPerMtok) {
  const validatedModel = validateModelId(model);
  const exact = Object.prototype.hasOwnProperty.call(pricing, validatedModel) ? pricing[validatedModel] : undefined;
  if (exact) return { price: exact, usedFallback: false };
  const prices = Object.values(pricing);
  if (prices.length === 0) throw new Error("E-CFG03: LLM pricing table must not be empty");
  return {
    price: prices.reduce((max, price) => ({
      input: Math.max(max.input, price.input),
      output: Math.max(max.output, price.output),
    })),
    usedFallback: true,
  };
}

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  pricingUsdPerMtok: ModelPricingUsdPerMtok,
  cacheCreationInputTokens = 0,
  cacheReadInputTokens = 0,
): number {
  validateTokenCount(inputTokens, "inputTokens");
  validateTokenCount(outputTokens, "outputTokens");
  validateTokenCount(cacheCreationInputTokens, "cacheCreationInputTokens");
  validateTokenCount(cacheReadInputTokens, "cacheReadInputTokens");
  const { price } = resolveModelPrice(model, pricingUsdPerMtok);
  const cost =
    (inputTokens * price.input +
      cacheCreationInputTokens * price.input * 1.25 +
      cacheReadInputTokens * price.input * 0.1 +
      outputTokens * price.output) /
    1_000_000;
  if (
    !Number.isFinite(cost) ||
    cost < 0 ||
    (cost === 0 && (inputTokens > 0 || outputTokens > 0 || cacheCreationInputTokens > 0 || cacheReadInputTokens > 0))
  ) {
    throw new Error("E-COST02: estimated cost must be finite and positive for non-zero usage");
  }
  return cost;
}

export class DailyCostLimitExceededError extends Error {
  constructor(spend: number, limit: number) {
    super(
      `E-COST01: daily LLM spend $${spend.toFixed(2)} would exceed limit $${limit.toFixed(2)} (PrjOps:SPEC-INT-060)`,
    );
  }
}

export class AnthropicRefusalError extends Error {
  constructor(model: string) {
    super(`E-LLM-REFUSAL: Anthropic returned stop_reason=refusal [model=${model}]`);
    this.name = "AnthropicRefusalError";
  }
}

export interface StructuredCallOptions<T> {
  agent: string; // "AGT-02" 等。llm_usage.jsonlの識別用
  purpose: string; // "free_text_structuring" 等
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  inputSchema: Record<string, unknown>; // Anthropic tool input_schema (JSON Schema)
  parse: (raw: unknown) => T; // zod等でのランタイム再検証
  maxAttempts?: number; // 既定2（PrjOps:SPEC-INT-030）
  allowEscalation?: boolean; // (a)自由文構造化のみtrue。3回連続失敗時にESCALATION_MODELへ昇格し1回再試行
  model?: string;
}

export interface StructuredCallResult<T> {
  value: T;
  model: string;
  attempts: number;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

export interface AnthropicStructuredClientOptions {
  defaultModel: string;
  escalationModel: string;
  pricingUsdPerMtok: ModelPricingUsdPerMtok;
  auditLog?: AuditLogWriter;
  traceIdProvider?: () => string;
}

export class AnthropicStructuredClient {
  private readonly clientOptions: AnthropicStructuredClientOptions;

  constructor(
    private readonly client: Anthropic,
    private readonly costGuard: CostGuard,
    clientOptions: AnthropicStructuredClientOptions,
  ) {
    this.clientOptions = {
      ...clientOptions,
      defaultModel: validateModelId(clientOptions.defaultModel, "defaultModel"),
      escalationModel: validateModelId(clientOptions.escalationModel, "escalationModel"),
      pricingUsdPerMtok: validateModelPricingUsdPerMtok(clientOptions.pricingUsdPerMtok),
    };
    if (Boolean(clientOptions.auditLog) !== Boolean(clientOptions.traceIdProvider)) {
      throw new Error("E-CFG04: auditLog and traceIdProvider must be configured together");
    }
  }

  async call<T>(opts: StructuredCallOptions<T>): Promise<StructuredCallResult<T>> {
    const maxAttempts = opts.maxAttempts ?? 2;
    const model = validateModelId(opts.model ?? this.clientOptions.defaultModel);
    const pricing = this.clientOptions.pricingUsdPerMtok;
    const sanitizedUser = sanitizeForLlmInput(opts.user).sanitized;
    // 現在の呼び出し元のsystemは静的文字列だが、外部由来テキストを差し込む
    // 呼び出しが将来追加されても無防備にならないよう、userと同じゲートを通す。
    const sanitizedSystem = sanitizeForLlmInput(opts.system).sanitized;

    let lastError: unknown;
    let attempts = 0;
    let currentModel = model;
    const auditedUnknownModels = new Set<string>();

    const totalRounds = opts.allowEscalation ? maxAttempts + 1 : maxAttempts; // +1 for escalation retry
    for (let i = 0; i < totalRounds; i++) {
      attempts += 1;
      // 昇格判定: (a)自由文構造化で、通常試行をすべて使い切った直後の1回のみOpusへ昇格（PrjOps:SPEC-INT-001）
      if (opts.allowEscalation && i === maxAttempts) {
        currentModel = this.clientOptions.escalationModel;
      }

      const estimatedInputTokens = Math.ceil((sanitizedSystem.length + sanitizedUser.length) / 4) + 256;
      const { price, usedFallback } = resolveModelPrice(currentModel, pricing);
      if (usedFallback && !this.clientOptions.auditLog) {
        throw new Error("E-CFG04: auditLog is required for unknown model pricing fallback");
      }
      if (usedFallback && !auditedUnknownModels.has(currentModel)) {
        const traceId = this.clientOptions.traceIdProvider?.();
        if (!traceId) throw new Error("E-CFG04: traceIdProvider is required when pricing audit is enabled");
        await this.clientOptions.auditLog!.append({
          trace_id: traceId,
          actor: opts.agent,
          action: "llm_unknown_model_pricing_fallback",
          basis: "PrjOps:SPEC-INT-060",
          detail: { severity: "warn", model: currentModel, applied_price_usd_per_mtok: price },
          at: new Date().toISOString(),
        });
        auditedUnknownModels.add(currentModel);
      }
      const reservedUsage: LlmUsageRecord = {
        at: new Date().toISOString(),
        agent: opts.agent,
        purpose: opts.purpose,
        model: currentModel,
        input_tokens: estimatedInputTokens,
        output_tokens: 2048,
        // A cache miss bills the cacheable prefix at 1.25x, so reserve that
        // conservative case before the request instead of exceeding the limit later.
        estimated_cost_usd: estimateCostUsd(currentModel, 0, 2048, pricing, estimatedInputTokens),
      };
      const reservationId = await this.costGuard.reserve(reservedUsage);

      let reconciledActualUsage = false;
      try {
        const request = {
          model: currentModel,
          max_tokens: 2048,
          ...(shouldSendTemperature(currentModel, this.clientOptions.escalationModel) ? { temperature: 0 } : {}),
          system: [{ type: "text", text: sanitizedSystem, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: sanitizedUser }],
          tools: [
            {
              name: opts.toolName,
              description: opts.toolDescription,
              input_schema: opts.inputSchema as Anthropic.Tool.InputSchema,
              cache_control: { type: "ephemeral" },
            },
          ],
          tool_choice: { type: "tool", name: opts.toolName },
        } satisfies Anthropic.MessageCreateParamsNonStreaming;
        const response = await this.client.messages.create(request);
        const cacheCreationInputTokens = response.usage.cache_creation_input_tokens ?? 0;
        const cacheReadInputTokens = response.usage.cache_read_input_tokens ?? 0;

        const actualUsage = {
          at: new Date().toISOString(),
          agent: opts.agent,
          purpose: opts.purpose,
          model: currentModel,
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
          cache_creation_input_tokens: cacheCreationInputTokens,
          cache_read_input_tokens: cacheReadInputTokens,
          estimated_cost_usd: estimateCostUsd(
            currentModel,
            response.usage.input_tokens,
            response.usage.output_tokens,
            pricing,
            cacheCreationInputTokens,
            cacheReadInputTokens,
          ),
        };
        await this.costGuard.reconcileReservation(reservationId, actualUsage);
        reconciledActualUsage = true;

        if ((response as { stop_reason?: string }).stop_reason === "refusal") {
          throw new AnthropicRefusalError(currentModel);
        }

        const toolUseBlock = response.content.find(
          (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === opts.toolName,
        );
        if (!toolUseBlock) {
          throw new Error("E-GEN01: model did not return the forced tool_use block");
        }
        const value = opts.parse(toolUseBlock.input);
        return {
          value,
          model: currentModel,
          attempts,
          usage: {
            input_tokens: response.usage.input_tokens,
            output_tokens: response.usage.output_tokens,
            cache_creation_input_tokens: cacheCreationInputTokens,
            cache_read_input_tokens: cacheReadInputTokens,
          },
        };
      } catch (err) {
        if (err instanceof AnthropicRefusalError || err instanceof DailyCostLimitExceededError) throw err;
        if (!reconciledActualUsage) {
          await this.costGuard.reconcileReservation(reservationId, {
            ...reservedUsage,
            at: new Date().toISOString(),
            input_tokens: 0,
            output_tokens: 0,
            estimated_cost_usd: 0,
          });
        }
        lastError = err;
        // 次のループでリトライ（最終ラウンドなら下でthrow）
      }
    }
    throw new Error(
      `E-ING03: structured call failed after ${attempts} attempt(s) [agent=${opts.agent}, purpose=${opts.purpose}]: ${String(
        lastError,
      )}`,
    );
  }
}

export function shouldSendTemperature(model: string, escalationModel: string): boolean {
  return model !== escalationModel;
}

/* ------------------------------------------------------------------------- *
 * Gateway transport（P2-T05、FinalArch:LLM-001 / FinalArch:LLM-004 / ADR-0022）
 *
 * 全 inference は LiteLLM gateway の logical alias 経由が正。共有クライアントは
 * baseURL と virtual key を注入された gateway transport を既定とし、
 * api.anthropic.com への direct mode は移行期の明示フラグの背後にのみ残す。
 * ------------------------------------------------------------------------- */

/** virtual key（gateway）/ API key（direct 移行期のみ）を呼び出し毎に解決する。 */
export interface AnthropicTokenProvider {
  getToken(): Promise<string>;
}

export type AnthropicTransportMode = "gateway" | "direct";

export interface AnthropicTransportOptions {
  mode: AnthropicTransportMode;
  /** gateway: LiteLLM の URL（必須）。direct: 指定不可（SDK 既定 api.anthropic.com）。 */
  baseURL?: string;
  tokenProvider: AnthropicTokenProvider;
  /** direct mode は移行期のみ。明示 true がない direct 構成は構成時に失敗する。 */
  allowDirectModeMigration?: boolean;
  /** テスト・ポリシー注入用。既定は globalThis.fetch。 */
  fetch?: FetchLike;
  /** リクエストタイムアウト(ms)。既定は SDK 既定に委譲。 */
  timeoutMs?: number;
}

const DIRECT_ANTHROPIC_HOST = "api.anthropic.com";

/** FQDN 表記ゆれ（末尾ドット・大文字）を潰した比較用ホスト名。 */
function normalizeHostname(hostname: string): string {
  return hostname.replace(/\.+$/u, "").toLowerCase();
}

/** protocol + host + 実効 port の正規化 origin（末尾ドット host も同一視）。 */
function canonicalOrigin(url: URL): string {
  const port = url.port !== "" ? url.port : url.protocol === "https:" ? "443" : "80";
  return `${url.protocol}//${normalizeHostname(url.hostname)}:${port}`;
}

function validateGatewayBaseUrl(baseURL: string | undefined): URL {
  if (!baseURL) throw new Error("E-CFG05: gateway mode requires baseURL (LiteLLM endpoint)");
  let parsed: URL;
  try {
    parsed = new URL(baseURL);
  } catch {
    throw new Error("E-CFG05: gateway baseURL must be a valid URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("E-CFG05: gateway baseURL must be http(s)");
  }
  if (normalizeHostname(parsed.hostname) === DIRECT_ANTHROPIC_HOST) {
    throw new Error(
      "E-CFG05: gateway mode must not target api.anthropic.com (use direct mode behind the migration flag)",
    );
  }
  return parsed;
}

/**
 * gateway 既定の Anthropic SDK クライアントを構築する。トークンは注入された
 * TokenProvider からリクエスト毎に解決し（rotation/expiry 対応）、fetch ラッパで
 * 認証ヘッダを差し替えるため、SDK コンストラクタへ実キーは渡らない。
 * egress 境界は fetch ラッパで実 URL に対して強制する（SDK の絶対 URL 指定や
 * 構成外 origin へはトークン解決前に fail-closed）。
 */
export function createAnthropicTransport(options: AnthropicTransportOptions): Anthropic {
  const { mode, tokenProvider } = options;
  if (mode !== "gateway" && mode !== "direct") {
    throw new Error("E-CFG05: mode must be 'gateway' or 'direct'");
  }
  if (mode === "direct") {
    if (options.allowDirectModeMigration !== true) {
      throw new Error("E-CFG05: direct mode is migration-only and requires allowDirectModeMigration=true");
    }
    if (options.baseURL !== undefined) {
      throw new Error("E-CFG05: direct mode must not override baseURL");
    }
  }
  const gatewayUrl = mode === "gateway" ? validateGatewayBaseUrl(options.baseURL) : undefined;
  const expectedOrigin = canonicalOrigin(gatewayUrl ?? new URL(`https://${DIRECT_ANTHROPIC_HOST}`));
  const inner: FetchLike = options.fetch ?? (fetch as unknown as FetchLike);

  const authenticatedFetch = async (input: unknown, init: RequestInit = {}): Promise<Response> => {
    // 実リクエスト URL の origin を構成値と照合してから初めてトークンを解決する。
    // SDK の絶対 URL 指定（client.post 等）による構成外 origin への送信と、
    // その経路での virtual key 付与をここで遮断する（P2-T05-001）。
    let requestUrl: URL;
    try {
      requestUrl = new URL(String(input));
    } catch {
      throw new Error("E-CFG05: request URL must be absolute");
    }
    if (canonicalOrigin(requestUrl) !== expectedOrigin) {
      throw new Error(`E-CFG05: request origin ${requestUrl.origin} is outside the configured ${mode} endpoint`);
    }
    const token = await tokenProvider.getToken();
    if (typeof token !== "string" || token.trim().length === 0) {
      throw new Error("E-CFG05: token provider returned an empty token");
    }
    const headers = new Headers(init.headers);
    if (mode === "gateway") {
      // LiteLLM virtual key。x-api-key(SDK 既定のプレースホルダ)は送らない。
      headers.set("authorization", `Bearer ${token}`);
      headers.delete("x-api-key");
    } else {
      headers.set("x-api-key", token);
    }
    // 認証ヘッダ付きリクエストの cross-origin リダイレクト再送を禁止する。
    return inner(String(input), { ...init, headers, redirect: "error" });
  };

  return new Anthropic({
    // 実キーはヘッダ差し替えで供給される。この値がネットワークへ出ることはない。
    apiKey: "managed-by-token-provider",
    ...(gatewayUrl ? { baseURL: gatewayUrl.toString() } : {}),
    ...(options.timeoutMs !== undefined ? { timeout: options.timeoutMs } : {}),
    fetch: authenticatedFetch as unknown as NonNullable<ConstructorParameters<typeof Anthropic>[0]>["fetch"],
  });
}

/* ------------------------------------------------------------------------- *
 * Error normalization（P2-T05、FinalArch:LLM-004）
 *
 * 語彙は正典 model-routing 契約（deploy/litellm/model-aliases.yaml の
 * aiops_settings.on_errors / fallback_forbidden_errors）と同一。fallback 適格性は
 * この語彙で機械判定し、forbidden class での failover を構造的に不可能にする。
 * ------------------------------------------------------------------------- */

export const FALLBACK_ALLOWED_ERROR_CLASSES = [
  "timeout",
  "rate_limited",
  "provider_5xx",
  "regional_unavailable",
  "model_temporarily_unavailable",
] as const;

export const FALLBACK_FORBIDDEN_ERROR_CLASSES = [
  "safety_refusal",
  "policy_denied",
  "classification_denied",
  "prompt_injection",
  "invalid_request",
  "context_limit",
] as const;

export type LlmErrorClass =
  (typeof FALLBACK_ALLOWED_ERROR_CLASSES)[number] | (typeof FALLBACK_FORBIDDEN_ERROR_CLASSES)[number] | "unknown";

export interface NormalizedLlmError {
  errorClass: LlmErrorClass;
  /** 正典 on_errors に含まれる class のみ true。unknown は fail-closed で false。 */
  fallbackEligible: boolean;
  httpStatus?: number;
  /** secretSanitizer 済み・512 文字上限のログ安全メッセージ。 */
  message: string;
}

const MAX_NORMALIZED_MESSAGE_LENGTH = 512;
const CONTEXT_LIMIT_PATTERN = /context|prompt is too long|max_tokens|token limit/iu;

function extractHttpStatus(error: unknown): number | undefined {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number" && Number.isInteger(status)) return status;
  }
  return undefined;
}

function safeMessage(error: unknown): string {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return sanitizeSecrets(raw).sanitized.slice(0, MAX_NORMALIZED_MESSAGE_LENGTH);
}

const NETWORK_SIGNAL_PATTERN = /fetch failed|network|ECONNREFUSED|ECONNRESET|EAI_AGAIN|ENOTFOUND|EPIPE|socket/iu;
const TIMEOUT_SIGNAL_PATTERN = /timeout|timed out|ETIMEDOUT|AbortError/iu;
const MAX_CAUSE_DEPTH = 5;

/** error とその cause 連鎖（深さ上限つき）の name+message を連結する。 */
function errorChainText(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth <= MAX_CAUSE_DEPTH && current instanceof Error; depth += 1) {
    parts.push(`${current.name}: ${current.message}`);
    current = current.cause;
  }
  return parts.join(" <- ");
}

export function normalizeAnthropicError(error: unknown): NormalizedLlmError {
  const message = safeMessage(error);
  const httpStatus = extractHttpStatus(error);
  const classify = (): LlmErrorClass => {
    if (error instanceof AnthropicRefusalError) return "safety_refusal";
    if (error instanceof DailyCostLimitExceededError) return "policy_denied";
    if (error instanceof DOMException && error.name === "AbortError") return "timeout";
    // HTTP status は権威。forbidden な 4xx がメッセージ文言（"timed out" 等）で
    // fallback 適格へ化けないよう、文言ヒューリスティクスより先に判定する（P2-T05-002）。
    if (httpStatus !== undefined) {
      if (httpStatus === 408) return "timeout";
      if (httpStatus === 429) return "rate_limited";
      if (httpStatus === 529) return "model_temporarily_unavailable";
      if (httpStatus >= 500) return "provider_5xx";
      if (httpStatus === 401 || httpStatus === 403) return "policy_denied";
      if (httpStatus === 400 || httpStatus === 404 || httpStatus === 422) {
        return CONTEXT_LIMIT_PATTERN.test(message) ? "context_limit" : "invalid_request";
      }
      return "unknown";
    }
    // status なし = 接続層/SDK ラッパの失敗。SDK 0.115 は fetch/DNS/RST を
    // APIConnectionError("Connection error.") に包み原因を cause に持つため、
    // cause 連鎖まで見て分類する（P2-T05-003）。
    if (!(error instanceof Error)) return "unknown";
    const chain = errorChainText(error);
    // fetch ラッパ由来の構成・トークン失敗は一過性ではない。fail-closed を維持する。
    if (chain.includes("E-CFG05")) return "unknown";
    if (TIMEOUT_SIGNAL_PATTERN.test(chain) || error instanceof Anthropic.APIConnectionTimeoutError) return "timeout";
    // SDK の接続エラーは instanceof で判定する（Error.name は可変で偽装可能なため
    // 文字列比較は使わない。P2-T05-004）。
    if (NETWORK_SIGNAL_PATTERN.test(chain) || error instanceof Anthropic.APIConnectionError) {
      return "model_temporarily_unavailable";
    }
    return "unknown";
  };
  const errorClass = classify();
  return {
    errorClass,
    fallbackEligible: (FALLBACK_ALLOWED_ERROR_CLASSES as readonly string[]).includes(errorClass),
    ...(httpStatus !== undefined ? { httpStatus } : {}),
    message,
  };
}
