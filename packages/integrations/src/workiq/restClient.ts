// 根拠: ADR-0024 / WIQ-001 / WIQ-005
import { fetchWithBackoff, withTimeout, type FetchLike } from "@aiops/shared";

import { validateWorkIqDelegatedClaims, type ValidatedWorkIqDelegatedClaims } from "./tokenClaims.js";

export const WORKIQ_MCP_ENDPOINT = "https://workiq.svc.cloud.microsoft/mcp";

export type WorkIqClientErrorCode =
  "E-WIQ-HTTP" | "E-WIQ-IDENTITY" | "E-WIQ-MALFORMED" | "E-WIQ-NETWORK" | "E-WIQ-TIMEOUT";

export interface WorkIqDelegatedToken {
  readonly accessToken: string;
  readonly claims: ValidatedWorkIqDelegatedClaims;
}

export interface WorkIqDelegatedTokenProvider {
  getToken(): Promise<WorkIqDelegatedToken>;
}

export interface WorkIqRestClientOptions {
  readonly fetchImpl: FetchLike;
  readonly tokenProvider: WorkIqDelegatedTokenProvider;
  readonly expectedTenantId: string;
  readonly timeoutMs?: number;
}

export type WorkIqSourceReference = Readonly<Record<string, unknown>>;
export type WorkIqPermissionContext = Readonly<Record<string, unknown>>;

export interface WorkIqProvenance {
  readonly sourceReferences: readonly WorkIqSourceReference[];
  readonly permissionContext: WorkIqPermissionContext | null;
  readonly provenanceComplete: boolean;
}

export interface WorkIqFetchInput {
  readonly entityUrls: readonly string[];
}

export interface WorkIqFetchItem extends WorkIqProvenance {
  readonly data: Readonly<Record<string, unknown>>;
  readonly statusCode: number;
}

export interface WorkIqFetchResult extends WorkIqProvenance {
  readonly results: readonly WorkIqFetchItem[];
}

export interface WorkIqAskInput {
  readonly question: string;
  readonly conversationId?: string;
}

export interface WorkIqAskResult extends WorkIqProvenance {
  readonly response: string;
  readonly conversationId: string;
}

export interface WorkIqGetSchemaInput {
  readonly path?: string;
  readonly operationIds?: string;
  readonly format?: "jsonschema" | "typescript";
}

export interface WorkIqGetSchemaResult extends WorkIqProvenance {
  readonly schema: Readonly<Record<string, unknown>> | string;
}

export type WorkIqClientResult<T> =
  | { readonly ok: true; readonly value: T; readonly identity: ValidatedWorkIqDelegatedClaims }
  | { readonly ok: false; readonly errorCode: WorkIqClientErrorCode };

type ToolName = "ask" | "fetch" | "get_schema";

const REQUEST_ID = 1;
const MAX_TIMEOUT_MS = 30_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function assertRelativeGraphPath(path: string): void {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || path.includes("#")) {
    throw new TypeError("E-WIQ-INPUT: Work IQ resource path must be relative");
  }
  const rawPath = path.split("?", 1)[0] ?? "";
  let segments: string[];
  try {
    segments = rawPath.split("/").map((segment) => decodeURIComponent(segment));
  } catch {
    throw new TypeError("E-WIQ-INPUT: Work IQ resource path encoding is invalid");
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new TypeError("E-WIQ-INPUT: Work IQ resource path traversal is forbidden");
  }
  const parsed = new URL(path, "https://workiq-path.invalid");
  for (const key of parsed.searchParams.keys()) {
    if (key.toLowerCase() === "$skip" || key.toLowerCase() === "$skiptoken") {
      throw new TypeError("E-WIQ-INPUT: Work IQ blocked pagination parameter");
    }
  }
}

function assertFetchInput(input: WorkIqFetchInput): void {
  if (!Array.isArray(input.entityUrls) || input.entityUrls.length === 0) {
    throw new TypeError("E-WIQ-INPUT: entityUrls must be a non-empty array");
  }
  for (const path of input.entityUrls) {
    if (typeof path !== "string") throw new TypeError("E-WIQ-INPUT: entityUrls must contain strings");
    assertRelativeGraphPath(path);
  }
}

function assertAskInput(input: WorkIqAskInput): void {
  if (typeof input.question !== "string" || input.question.trim() === "") {
    throw new TypeError("E-WIQ-INPUT: question is required");
  }
  if (
    input.conversationId !== undefined &&
    (typeof input.conversationId !== "string" || input.conversationId.trim() === "")
  ) {
    throw new TypeError("E-WIQ-INPUT: conversationId must not be empty");
  }
}

function schemaArguments(input: WorkIqGetSchemaInput): Record<string, string> {
  const hasPath = input.path !== undefined;
  const hasOperationId = input.operationIds !== undefined;
  if (hasPath === hasOperationId) {
    throw new TypeError("E-WIQ-INPUT: provide exactly one of path or operationIds");
  }
  if (input.path !== undefined) assertRelativeGraphPath(input.path);
  if (input.operationIds !== undefined && input.operationIds.trim() === "") {
    throw new TypeError("E-WIQ-INPUT: operationIds must not be empty");
  }
  if (input.format !== undefined && input.format !== "jsonschema" && input.format !== "typescript") {
    throw new TypeError("E-WIQ-INPUT: schema format is invalid");
  }
  return {
    ...(input.path === undefined ? {} : { path: input.path }),
    ...(input.operationIds === undefined ? {} : { operationIds: input.operationIds }),
    operationType: "fetch",
    ...(input.format === undefined ? {} : { format: input.format }),
  };
}

function parseSse(text: string): unknown {
  const messages = text
    .split(/\r?\n\r?\n/u)
    .map((event) =>
      event
        .split(/\r?\n/u)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n"),
    )
    .filter(Boolean)
    .map((data) => JSON.parse(data) as unknown)
    .filter((message) => isRecord(message) && message.id === REQUEST_ID);
  if (messages.length !== 1) throw new Error("invalid Work IQ SSE response");
  return messages[0];
}

async function parseEnvelope(response: Response): Promise<unknown> {
  const text = await response.text();
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  const envelope = contentType === "text/event-stream" ? parseSse(text) : (JSON.parse(text) as unknown);
  if (!isRecord(envelope) || envelope.jsonrpc !== "2.0" || envelope.id !== REQUEST_ID || "error" in envelope) {
    throw new Error("invalid Work IQ JSON-RPC envelope");
  }
  const result = envelope.result;
  if (
    !isRecord(result) ||
    (result.isError !== undefined && typeof result.isError !== "boolean") ||
    result.isError === true ||
    !Array.isArray(result.content)
  ) {
    throw new Error("invalid Work IQ tool result");
  }
  if (result.structuredContent !== undefined) {
    if (!isRecord(result.structuredContent)) throw new Error("invalid Work IQ structured content");
    return result.structuredContent;
  }
  if (
    result.content.length !== 1 ||
    !isRecord(result.content[0]) ||
    result.content[0].type !== "text" ||
    typeof result.content[0].text !== "string"
  ) {
    throw new Error("invalid Work IQ text content");
  }
  try {
    return JSON.parse(result.content[0].text) as unknown;
  } catch {
    return result.content[0].text;
  }
}

/**
 * Microsoft core payload reference:
 * https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/work-iq/mcp/tool-reference
 * ADR-0024's sourceReferences and permissionContext extensions are preserved verbatim when supplied.
 */
function parseProvenance(value: Record<string, unknown>): WorkIqProvenance | undefined {
  const sourceReferences = value.sourceReferences ?? [];
  const permissionContext = value.permissionContext ?? null;
  if (
    !Array.isArray(sourceReferences) ||
    !sourceReferences.every((reference) => isRecord(reference) && Object.keys(reference).length > 0)
  ) {
    return undefined;
  }
  if (permissionContext !== null && !isRecord(permissionContext)) return undefined;
  return {
    sourceReferences,
    permissionContext,
    provenanceComplete:
      sourceReferences.length > 0 && permissionContext !== null && Object.keys(permissionContext).length > 0,
  };
}

function parseFetchItem(value: unknown): WorkIqFetchItem | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, ["data", "statusCode", "sourceReferences", "permissionContext"])) {
    return undefined;
  }
  if (
    !isRecord(value.data) ||
    !Number.isInteger(value.statusCode) ||
    (value.statusCode as number) < 100 ||
    (value.statusCode as number) > 599
  ) {
    return undefined;
  }
  const provenance = parseProvenance(value);
  return provenance === undefined
    ? undefined
    : { data: value.data, statusCode: value.statusCode as number, ...provenance };
}

function parseFetch(value: unknown): WorkIqFetchResult | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, ["results", "sourceReferences", "permissionContext"])) {
    return undefined;
  }
  if (!Array.isArray(value.results)) return undefined;
  const results = value.results.map(parseFetchItem);
  const provenance = parseProvenance(value);
  return results.some((result) => result === undefined) || provenance === undefined
    ? undefined
    : { results: results as WorkIqFetchItem[], ...provenance };
}

function parseAsk(value: unknown): WorkIqAskResult | undefined {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["response", "conversationId", "sourceReferences", "permissionContext"]) ||
    typeof value.response !== "string" ||
    value.response.trim() === "" ||
    typeof value.conversationId !== "string" ||
    value.conversationId.trim() === ""
  ) {
    return undefined;
  }
  const provenance = parseProvenance(value);
  return provenance === undefined
    ? undefined
    : { response: value.response, conversationId: value.conversationId, ...provenance };
}

function parseSchema(value: unknown, format: "jsonschema" | "typescript"): WorkIqGetSchemaResult | undefined {
  if (format === "typescript") {
    if (typeof value !== "string") return undefined;
    return value.trim() === ""
      ? undefined
      : { schema: value, sourceReferences: [], permissionContext: null, provenanceComplete: false };
  }
  if (!isRecord(value)) return undefined;
  const provenance = parseProvenance(value);
  if (provenance === undefined) return undefined;
  return { schema: value, ...provenance };
}

export class WorkIqRestClient {
  private readonly fetchImpl: FetchLike;
  private readonly tokenProvider: WorkIqDelegatedTokenProvider;
  private readonly expectedTenantId: string;

  constructor(options: WorkIqRestClientOptions) {
    const endpoint = new URL(WORKIQ_MCP_ENDPOINT);
    if (endpoint.origin !== "https://workiq.svc.cloud.microsoft" || endpoint.pathname !== "/mcp") {
      throw new TypeError("E-WIQ-CONFIG: canonical Work IQ MCP endpoint mismatch");
    }
    const timeoutMs = options.timeoutMs ?? 10_000;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS) {
      throw new TypeError("E-WIQ-CONFIG: timeoutMs must be an integer between 1 and 30000");
    }
    this.fetchImpl = withTimeout(options.fetchImpl, timeoutMs);
    this.tokenProvider = options.tokenProvider;
    this.expectedTenantId = options.expectedTenantId;
  }

  async fetch(input: WorkIqFetchInput): Promise<WorkIqClientResult<WorkIqFetchResult>> {
    assertFetchInput(input);
    const entityUrls = [...input.entityUrls];
    const result = await this.call(
      "fetch",
      { entityUrls },
      (value) => {
        const parsed = parseFetch(value);
        return parsed?.results.length === entityUrls.length ? parsed : undefined;
      },
      true,
    );
    return result.ok && result.value.results.some(({ statusCode }) => statusCode < 200 || statusCode > 299)
      ? { ok: false, errorCode: "E-WIQ-HTTP" }
      : result;
  }

  ask(input: WorkIqAskInput): Promise<WorkIqClientResult<WorkIqAskResult>> {
    assertAskInput(input);
    return this.call(
      "ask",
      {
        question: input.question,
        ...(input.conversationId === undefined ? {} : { conversationId: input.conversationId }),
      },
      parseAsk,
      false,
    );
  }

  getSchema(input: WorkIqGetSchemaInput): Promise<WorkIqClientResult<WorkIqGetSchemaResult>> {
    const format = input.format ?? "jsonschema";
    return this.call("get_schema", schemaArguments(input), (value) => parseSchema(value, format), true);
  }

  private async call<T>(
    name: ToolName,
    args: Record<string, unknown>,
    parse: (value: unknown) => T | undefined,
    idempotent: boolean,
  ): Promise<WorkIqClientResult<T>> {
    let token: WorkIqDelegatedToken;
    let identity: ValidatedWorkIqDelegatedClaims;
    try {
      token = await this.tokenProvider.getToken();
      if (typeof token.accessToken !== "string" || !/^\S+$/u.test(token.accessToken)) throw new Error("invalid token");
      identity = validateWorkIqDelegatedClaims(
        {
          iss: token.claims.issuer,
          tid: token.claims.tenantId,
          aud: token.claims.audience,
          sub: token.claims.subject,
          scp: Array.isArray(token.claims.scopes) ? token.claims.scopes.join(" ") : "",
        },
        this.expectedTenantId,
      );
    } catch {
      return { ok: false, errorCode: "E-WIQ-IDENTITY" };
    }

    let response: Response;
    try {
      response = await fetchWithBackoff(
        this.fetchImpl,
        WORKIQ_MCP_ENDPOINT,
        {
          method: "POST",
          headers: {
            accept: "application/json, text/event-stream",
            authorization: `Bearer ${token.accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: REQUEST_ID,
            method: "tools/call",
            params: { name, arguments: args },
          }),
        },
        { maxRetries: idempotent ? 1 : 0, initialDelayMs: 1, maxDelayMs: 1 },
        idempotent ? "idempotent" : "non-idempotent",
      );
    } catch (error) {
      return {
        ok: false,
        errorCode: error instanceof DOMException && error.name === "AbortError" ? "E-WIQ-TIMEOUT" : "E-WIQ-NETWORK",
      };
    }
    if (!response.ok) return { ok: false, errorCode: "E-WIQ-HTTP" };

    try {
      const value = parse(await parseEnvelope(response));
      return value === undefined ? { ok: false, errorCode: "E-WIQ-MALFORMED" } : { ok: true, value, identity };
    } catch {
      return { ok: false, errorCode: "E-WIQ-MALFORMED" };
    }
  }
}
