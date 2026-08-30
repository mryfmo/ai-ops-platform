// 根拠: ADR-0030 / 添付TEXT「Jira・GitHub・ai-ops-platform構成」
// Jira Cloudへの最小権限REST境界。読み取りは再試行可能だが、transitionと
// Development Information投影はone-shot/no-retryで実行し、unknown resultは上位ledgerでreconcileする。
import { withTimeout, type FetchLike } from "@aiops/shared";
import type { TokenProvider } from "../adapters/types.js";

export interface JiraIssueBaseline {
  readonly updated: string;
  readonly statusId: string;
  readonly fieldHash: string;
}

export interface JiraIssueMetadata extends JiraIssueBaseline {
  readonly issueKey: string;
  readonly jiraProjectId: string;
  readonly assigneeAccountId: string | null;
  readonly sprintId: string | null;
}

export type JiraSnapshotIssue = JiraIssueMetadata;

export interface JiraSnapshot {
  readonly capturedAt: string;
  readonly captureComplete: boolean;
  readonly issues: readonly JiraSnapshotIssue[];
  readonly pageCount: number;
}

export interface JiraDevelopmentInformationInput {
  readonly cloudId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly idempotencyKey: string;
}

export type JiraTransitionResult =
  | { readonly result: "transitioned"; readonly baseline: JiraIssueBaseline }
  | { readonly result: "stale"; readonly observedBaseline: JiraIssueBaseline };

export interface JiraRestClientOptions {
  readonly fetchImpl: FetchLike;
  readonly tokenProvider: TokenProvider;
  /** e.g. https://example.atlassian.net */
  readonly siteBaseUrl: string;
  /** OAuth Jira Software API base. Defaults to https://api.atlassian.com */
  readonly platformBaseUrl?: string;
  readonly allowedStatusIds: readonly string[];
  readonly protectedStatusIds: readonly string[];
  readonly sprintFieldId?: string;
  readonly timeoutMs?: number;
  readonly maxSnapshotPages?: number;
  readonly maxSnapshotIssues?: number;
}

const ISSUE_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,29}-[1-9][0-9]{0,9}$/u;
const JIRA_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const CLOUD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CUSTOM_FIELD_PATTERN = /^customfield_[1-9][0-9]{0,15}$/u;
const MAX_TIMEOUT_MS = 30_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertJiraId(value: string, label: string): void {
  if (!JIRA_ID_PATTERN.test(value)) throw new TypeError(`E-JIRA-INPUT: ${label} is invalid`);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export async function computeJiraFieldHash(input: {
  readonly assigneeAccountId: string | null;
  readonly sprintId: string | null;
  readonly additionalFields?: Readonly<Record<string, unknown>>;
}): Promise<string> {
  const canonical = canonicalize({
    assigneeAccountId: input.assigneeAccountId,
    sprintId: input.sprintId,
    additionalFields: input.additionalFields ?? {},
  });
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(canonical)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sameBaseline(left: JiraIssueBaseline, right: JiraIssueBaseline): boolean {
  return left.updated === right.updated && left.statusId === right.statusId && left.fieldHash === right.fieldHash;
}

async function parseJsonOrEmpty(response: Response): Promise<unknown | null> {
  if (response.status === 202 || response.status === 204) return null;
  const text = await response.text();
  if (text.trim() === "") return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("E-JIRA-MALFORMED: response is not valid JSON");
  }
}

function readString(value: unknown, path: readonly string[]): string | null {
  let current: unknown = value;
  for (const key of path) {
    if (!isRecord(current)) return null;
    current = current[key];
  }
  return typeof current === "string" && current.trim() !== "" ? current : null;
}

function sprintId(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (let index = value.length - 1; index >= 0; index -= 1) {
      const candidate = value[index];
      const id = isRecord(candidate) ? candidate.id : null;
      if (typeof id === "number" || typeof id === "string") return String(id);
    }
    return null;
  }
  if (isRecord(value) && (typeof value.id === "number" || typeof value.id === "string")) return String(value.id);
  return null;
}

export class JiraRestClient {
  private readonly fetchImpl: FetchLike;
  private readonly tokenProvider: TokenProvider;
  private readonly siteBaseUrl: string;
  private readonly platformBaseUrl: string;
  private readonly allowedStatusIds: ReadonlySet<string>;
  private readonly protectedStatusIds: ReadonlySet<string>;
  private readonly sprintFieldId?: string;
  private readonly maxSnapshotPages: number;
  private readonly maxSnapshotIssues: number;

  constructor(options: JiraRestClientOptions) {
    const site = new URL(options.siteBaseUrl);
    if (
      site.protocol !== "https:" ||
      site.username ||
      site.password ||
      site.search ||
      site.hash ||
      site.pathname !== "/"
    ) {
      throw new TypeError("E-JIRA-CONFIG: siteBaseUrl must be an HTTPS origin");
    }
    const platform = new URL(options.platformBaseUrl ?? "https://api.atlassian.com");
    if (
      platform.protocol !== "https:" ||
      platform.username ||
      platform.password ||
      platform.search ||
      platform.hash ||
      platform.pathname !== "/"
    ) {
      throw new TypeError("E-JIRA-CONFIG: platformBaseUrl must be an HTTPS origin");
    }
    const timeoutMs = options.timeoutMs ?? 10_000;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS) {
      throw new TypeError("E-JIRA-CONFIG: timeoutMs must be between 1 and 30000");
    }
    if (options.allowedStatusIds.length === 0) {
      throw new TypeError("E-JIRA-CONFIG: allowedStatusIds must be non-empty (fail-closed)");
    }
    for (const id of [...options.allowedStatusIds, ...options.protectedStatusIds]) assertJiraId(id, "status ID");
    const allowed = new Set(options.allowedStatusIds);
    for (const id of options.protectedStatusIds) {
      if (!allowed.has(id)) throw new TypeError("E-JIRA-CONFIG: protected status must also be allowlisted");
    }
    if (options.sprintFieldId !== undefined && !CUSTOM_FIELD_PATTERN.test(options.sprintFieldId)) {
      throw new TypeError("E-JIRA-CONFIG: sprintFieldId must be a canonical customfield ID");
    }
    const maxSnapshotPages = options.maxSnapshotPages ?? 100;
    const maxSnapshotIssues = options.maxSnapshotIssues ?? 10_000;
    if (!Number.isInteger(maxSnapshotPages) || maxSnapshotPages < 1 || maxSnapshotPages > 1_000) {
      throw new TypeError("E-JIRA-CONFIG: maxSnapshotPages is out of range");
    }
    if (!Number.isInteger(maxSnapshotIssues) || maxSnapshotIssues < 1 || maxSnapshotIssues > 100_000) {
      throw new TypeError("E-JIRA-CONFIG: maxSnapshotIssues is out of range");
    }
    this.fetchImpl = withTimeout(options.fetchImpl, timeoutMs);
    this.tokenProvider = options.tokenProvider;
    this.siteBaseUrl = site.origin;
    this.platformBaseUrl = platform.origin;
    this.allowedStatusIds = allowed;
    this.protectedStatusIds = new Set(options.protectedStatusIds);
    this.sprintFieldId = options.sprintFieldId;
    this.maxSnapshotPages = maxSnapshotPages;
    this.maxSnapshotIssues = maxSnapshotIssues;
  }

  private async headers(extra: Record<string, string> = {}): Promise<Record<string, string>> {
    const token = (await this.tokenProvider.getAccessToken()).trim();
    if (!token) throw new Error("E-JIRA-AUTH: token provider returned an empty token");
    return { Authorization: `Bearer ${token}`, Accept: "application/json", ...extra };
  }

  private async parseIssue(value: unknown): Promise<JiraIssueMetadata> {
    if (!isRecord(value)) throw new Error("E-JIRA-MALFORMED: issue must be an object");
    const issueKey = typeof value.key === "string" ? value.key : "";
    const fields = isRecord(value.fields) ? value.fields : null;
    const jiraProjectId = readString(fields, ["project", "id"]);
    const statusId = readString(fields, ["status", "id"]);
    const updated = readString(fields, ["updated"]);
    if (!ISSUE_KEY_PATTERN.test(issueKey) || !fields || !jiraProjectId || !statusId || !updated) {
      throw new Error("E-JIRA-MALFORMED: issue metadata is incomplete");
    }
    if (!this.allowedStatusIds.has(statusId)) {
      throw new Error(`E-JIRA-STATUS: unknown status ${statusId} rejected by allowlist`);
    }
    if (Number.isNaN(Date.parse(updated))) throw new Error("E-JIRA-MALFORMED: updated timestamp is invalid");
    const assigneeAccountId = readString(fields, ["assignee", "accountId"]);
    const sprint = this.sprintFieldId ? sprintId(fields[this.sprintFieldId]) : null;
    const fieldHash = await computeJiraFieldHash({ assigneeAccountId, sprintId: sprint });
    return { issueKey, jiraProjectId, statusId, updated, assigneeAccountId, sprintId: sprint, fieldHash };
  }

  async readIssueMetadata(issueKey: string): Promise<JiraIssueMetadata> {
    if (!ISSUE_KEY_PATTERN.test(issueKey)) throw new TypeError("E-JIRA-INPUT: invalid issue key");
    const fields = ["project", "status", "assignee", "updated", ...(this.sprintFieldId ? [this.sprintFieldId] : [])];
    const url = new URL(`/rest/api/3/issue/${encodeURIComponent(issueKey)}`, this.siteBaseUrl);
    url.searchParams.set("fields", fields.join(","));
    const response = await this.fetchImpl(url.toString(), { method: "GET", headers: await this.headers() });
    if (!response.ok) throw new Error(`E-JIRA-HTTP: issue read failed with ${response.status}`);
    return this.parseIssue(await parseJsonOrEmpty(response));
  }

  /**
   * Complete JQL snapshot. A page token cycle, duplicate issue, page/issue bound breach,
   * malformed page, or transport failure throws; callers must never commit a partial snapshot.
   */
  async captureJqlSnapshot(jql: string, capturedAt = new Date()): Promise<JiraSnapshot> {
    if (typeof jql !== "string" || jql.trim() === "" || jql.length > 4_000) {
      throw new TypeError("E-JIRA-INPUT: JQL must be non-empty and bounded");
    }
    const seenPageTokens = new Set<string>();
    const seenIssueKeys = new Set<string>();
    const issues: JiraSnapshotIssue[] = [];
    let nextPageToken: string | null = null;
    let pageCount = 0;

    do {
      const tokenKey = nextPageToken ?? "<first-page>";
      if (seenPageTokens.has(tokenKey)) throw new Error("E-JIRA-SNAPSHOT: repeated page token cycle detected");
      seenPageTokens.add(tokenKey);
      pageCount += 1;
      if (pageCount > this.maxSnapshotPages) throw new Error("E-JIRA-SNAPSHOT: page bound exceeded");

      const url = new URL("/rest/api/3/search/jql", this.siteBaseUrl);
      url.searchParams.set("jql", jql);
      url.searchParams.set("maxResults", "100");
      url.searchParams.set(
        "fields",
        ["project", "status", "assignee", "updated", ...(this.sprintFieldId ? [this.sprintFieldId] : [])].join(","),
      );
      if (nextPageToken) url.searchParams.set("nextPageToken", nextPageToken);
      const response = await this.fetchImpl(url.toString(), { method: "GET", headers: await this.headers() });
      if (!response.ok) throw new Error(`E-JIRA-HTTP: JQL snapshot failed with ${response.status}`);
      const body = await parseJsonOrEmpty(response);
      if (!isRecord(body) || !Array.isArray(body.issues)) throw new Error("E-JIRA-MALFORMED: JQL page is invalid");
      for (const raw of body.issues) {
        const issue = await this.parseIssue(raw);
        if (seenIssueKeys.has(issue.issueKey)) {
          throw new Error(`E-JIRA-SNAPSHOT: duplicate issue ${issue.issueKey} across pages`);
        }
        seenIssueKeys.add(issue.issueKey);
        issues.push(issue);
        if (issues.length > this.maxSnapshotIssues) throw new Error("E-JIRA-SNAPSHOT: issue bound exceeded");
      }
      if (body.isLast === true) {
        nextPageToken = null;
      } else if (typeof body.nextPageToken === "string" && body.nextPageToken.trim() !== "") {
        nextPageToken = body.nextPageToken;
      } else {
        throw new Error("E-JIRA-MALFORMED: non-final JQL page requires nextPageToken");
      }
    } while (nextPageToken !== null);

    return { capturedAt: capturedAt.toISOString(), captureComplete: true, issues, pageCount };
  }

  /**
   * Guarded status transition. The immediate baseline read detects stale work and the result is
   * returned as a discriminated union. POST is deliberately one-shot/no-retry. Protected statuses
   * require the caller to prove a human approval UUID before invoking this client boundary.
   */
  async transitionIssue(input: {
    readonly issueKey: string;
    readonly transitionId: string;
    readonly targetStatusId: string;
    readonly expectedBaseline: JiraIssueBaseline;
    readonly approvalId: string;
  }): Promise<JiraTransitionResult> {
    if (!ISSUE_KEY_PATTERN.test(input.issueKey)) throw new TypeError("E-JIRA-INPUT: invalid issue key");
    assertJiraId(input.transitionId, "transitionId");
    assertJiraId(input.targetStatusId, "targetStatusId");
    if (!this.allowedStatusIds.has(input.targetStatusId))
      throw new Error("E-JIRA-STATUS: target status is not allowlisted");
    if (this.protectedStatusIds.has(input.targetStatusId) && !CLOUD_ID_PATTERN.test(input.approvalId)) {
      throw new Error("E-JIRA-APPROVAL: protected transition requires a human approval UUID");
    }
    const current = await this.readIssueMetadata(input.issueKey);
    const observedBaseline: JiraIssueBaseline = {
      updated: current.updated,
      statusId: current.statusId,
      fieldHash: current.fieldHash,
    };
    if (!sameBaseline(observedBaseline, input.expectedBaseline)) return { result: "stale", observedBaseline };

    const url = new URL(`/rest/api/3/issue/${encodeURIComponent(input.issueKey)}/transitions`, this.siteBaseUrl);
    const response = await this.fetchImpl(url.toString(), {
      method: "POST",
      headers: await this.headers({ "Content-Type": "application/json", "X-AIOPS-Approval-Id": input.approvalId }),
      body: JSON.stringify({ transition: { id: input.transitionId } }),
    });
    if (![200, 202, 204].includes(response.status)) {
      throw new Error(`E-JIRA-HTTP: transition failed with ${response.status}`);
    }
    await parseJsonOrEmpty(response); // 202/204 empty success is valid.
    return { result: "transitioned", baseline: input.expectedBaseline };
  }

  /** Jira Software Development Information projection; one-shot/no-retry. */
  async projectDevelopmentInformation(input: JiraDevelopmentInformationInput): Promise<void> {
    if (!CLOUD_ID_PATTERN.test(input.cloudId)) throw new TypeError("E-JIRA-INPUT: invalid cloudId");
    if (typeof input.idempotencyKey !== "string" || input.idempotencyKey.trim() === "") {
      throw new TypeError("E-JIRA-INPUT: idempotencyKey is required");
    }
    const url = new URL(`/jira/${encodeURIComponent(input.cloudId)}/rest/devinfo/0.10/bulk`, this.platformBaseUrl);
    const response = await this.fetchImpl(url.toString(), {
      method: "POST",
      headers: await this.headers({
        "Content-Type": "application/json",
        "X-AIOPS-Idempotency-Key": input.idempotencyKey,
      }),
      body: JSON.stringify(input.payload),
    });
    if (![200, 202, 204].includes(response.status)) {
      throw new Error(`E-JIRA-HTTP: development projection failed with ${response.status}`);
    }
    await parseJsonOrEmpty(response); // 202/204 with no response body is an accepted success.
  }
}
