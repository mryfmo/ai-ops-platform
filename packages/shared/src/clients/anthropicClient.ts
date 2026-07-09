/**
 * packages/shared/src/clients/anthropicClient.ts
 *
 * 根拠:
 *   - PrjOps SPEC-INT-001: LLMを使う処理は (a)自由文の構造化(AGT-02) (b)レポート要約文生成(AGT-04)
 *     (c)重要度引き上げ提案の理由文生成(AGT-03) の3つに限定。既定モデル claude-sonnet-4-6、
 *     (a)で3回連続構造化失敗時のみ claude-opus-4-8 に昇格して1回再試行。
 *   - PrjOps SPEC-INT-030: LLM構造化は温度0、スキーマへのJSON出力を強制。1件あたりLLM呼び出しは最大2回。
 *   - DevOps SPEC-INT-011/030/031/033: 分類・要約はClaude API（構造化JSON出力）。
 *   - DevOps SPEC-INT-070: LLMへの入力からシークレットパターンを除去するサニタイザを共通ライブラリとして実装。
 *   - PrjOps REQ-035 データ所在: 外部送信されるデータは Anthropic API・Microsoft Graph・GitHub に限定する
 *     （外部通信allowlist: api.anthropic.com, graph.microsoft.com, github.com/api.github.com のみ。
 *     SPEC-INT-060）。本クライアントが通信するホストは api.anthropic.com のみであり、この制約に従う。
 *
 * 実装方式: Anthropic Messages APIの「ツール強制（tool_choice: {type: "tool", name}）」パターンで
 * 構造化JSON出力を保証する。これはAnthropic公式SDK（@anthropic-ai/sdk）が現在サポートする
 * 最も確実な決定的構造化出力の方法であり（自由文からのJSON抽出よりパース失敗率が低い）、
 * 出力は呼び出し側のzodスキーマで再検証してから使用する（二重検証によりE-ING03/LLM出力スキーマ不適合を防ぐ）。
 */
import Anthropic from "@anthropic-ai/sdk";
import { sanitizeForLlmInput } from "../secretSanitizer.js";

export const DEFAULT_MODEL = "claude-sonnet-4-6";
export const ESCALATION_MODEL = "claude-opus-4-8";

export interface LlmUsageRecord {
  at: string;
  agent: string;
  purpose: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
}

export interface CostGuard {
  /** 本日すでに記録済みの合計コスト(USD)を返す */
  getTodaySpendUsd(): Promise<number>;
  /** 利用実績を記録する（audit/llm_usage.jsonl相当） */
  record(usage: LlmUsageRecord): Promise<void>;
  /** 日次上限（既定 $20。SPEC-INT-060。PRF-03が設定ファイルで変更可） */
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
  getRecords(): LlmUsageRecord[] {
    return [...this.records];
  }
}

// 2026-07時点の標準価格（開発環境表 DEV-04 / 運用環境表 OPS-01 に基づく。$/百万トークン）
const PRICING_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICING_USD_PER_MTOK[model] ?? PRICING_USD_PER_MTOK[DEFAULT_MODEL]!;
  return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
}

export class DailyCostLimitExceededError extends Error {
  constructor(spend: number, limit: number) {
    super(`E-COST01: daily LLM spend $${spend.toFixed(2)} would exceed limit $${limit.toFixed(2)} (SPEC-INT-060)`);
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
  maxAttempts?: number; // 既定2（SPEC-INT-030）
  allowEscalation?: boolean; // (a)自由文構造化のみtrue。3回連続失敗時にESCALATION_MODELへ昇格し1回再試行
  model?: string;
}

export interface StructuredCallResult<T> {
  value: T;
  model: string;
  attempts: number;
  usage: { input_tokens: number; output_tokens: number };
}

export class AnthropicStructuredClient {
  constructor(
    private readonly client: Anthropic,
    private readonly costGuard: CostGuard,
  ) {}

  async call<T>(opts: StructuredCallOptions<T>): Promise<StructuredCallResult<T>> {
    const maxAttempts = opts.maxAttempts ?? 2;
    const model = opts.model ?? DEFAULT_MODEL;
    const sanitizedUser = sanitizeForLlmInput(opts.user).sanitized;

    let lastError: unknown;
    let attempts = 0;
    let currentModel = model;

    const totalRounds = opts.allowEscalation ? maxAttempts + 1 : maxAttempts; // +1 for escalation retry
    for (let i = 0; i < totalRounds; i++) {
      attempts += 1;
      // 昇格判定: (a)自由文構造化で、通常試行をすべて使い切った直後の1回のみOpusへ昇格（SPEC-INT-001）
      if (opts.allowEscalation && i === maxAttempts) {
        currentModel = ESCALATION_MODEL;
      }

      const todaySpend = await this.costGuard.getTodaySpendUsd();
      if (todaySpend >= this.costGuard.dailyLimitUsd) {
        throw new DailyCostLimitExceededError(todaySpend, this.costGuard.dailyLimitUsd);
      }

      try {
        const response = await this.client.messages.create({
          model: currentModel,
          max_tokens: 2048,
          temperature: 0, // SPEC-INT-030: 温度0
          system: opts.system,
          messages: [{ role: "user", content: sanitizedUser }],
          tools: [
            {
              name: opts.toolName,
              description: opts.toolDescription,
              input_schema: opts.inputSchema as Anthropic.Tool.InputSchema,
            },
          ],
          tool_choice: { type: "tool", name: opts.toolName },
        });

        await this.costGuard.record({
          at: new Date().toISOString(),
          agent: opts.agent,
          purpose: opts.purpose,
          model: currentModel,
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
          estimated_cost_usd: estimateCostUsd(currentModel, response.usage.input_tokens, response.usage.output_tokens),
        });

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
          usage: { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
        };
      } catch (err) {
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
