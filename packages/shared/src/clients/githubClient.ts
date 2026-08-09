/**
 * packages/shared/src/clients/githubClient.ts
 *
 * 根拠:
 *   - DevOps:REQ-025 GitHub連携: リポジトリイベント(push, workflow_run, PR)をWebhookで受信し、
 *     Issue/PRコメント・デプロイをGitHub API経由で実行する（AC-025aはDevOps:SPEC-INT-010のディスパッチ
 *     60秒以内要件、本クライアントはそのAPI呼び出し部分を担当）。
 *   - PrjOps:SPEC-EXT-003 / REQ-004(c): GitHub構造化ファイルのコミット/PR受付。
 *   - DevOps:SPEC-INT-061: GitHub App認証（installation token）。Webhook購読: push, pull_request,
 *     workflow_run, issues。API操作: Issue/PRコメント作成、workflow_dispatch、権限付与API、監査ログ取得。
 *   - DevOps:SPEC-INT-020: 本番デプロイ実行はGitHub Actionsのdeploy-prodワークフローを
 *     workflow_dispatchで起動する方式。当該ワークフローはエージェントのサービスアカウントのみが
 *     起動できるようGitHub Environments保護ルールで制限する（AC-010a）。
 *   - PrjOps:REQ-033: 正本リポジトリへの書込はエージェント用マシンアカウントとPRF-03のみ。
 *
 * Webhook署名検証: GitHubはWebhookペイロードに対しHMAC-SHA256署名（X-Hub-Signature-256）を付与する。
 * 受信側での検証はGitHub公式ドキュメントが必須のセキュリティ対策として明記しており、本クライアントは
 * タイミング攻撃対策済みの定数時間比較（crypto.timingSafeEqual）で検証する。
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { fetchWithBackoff, withTimeout, type RetryOptions } from "./fetchPolicy.js";

export interface GitHubTokenProvider {
  getInstallationToken(): Promise<string>;
}

export type GhFetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * X-Hub-Signature-256 ヘッダを検証する（GitHub Webhook受信時の必須セキュリティチェック）。
 * @param payloadRaw リクエストボディの生バイト列（JSON.parse前の文字列であること。改行や空白の
 *                   正規化を行うと署名不一致になるため、必ず受信した生の文字列を渡す）
 */
export function verifyGithubWebhookSignature(
  payloadRaw: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(payloadRaw, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signatureHeader, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function projectV2FieldValue(fieldType: string, value: string): Record<string, string | number> {
  switch (fieldType.trim().toLowerCase()) {
    case "single_select":
    case "single-select":
    case "single_select_option":
      return { singleSelectOptionId: value };
    case "number":
      return { number: Number(value) };
    case "date":
      return { date: value };
    case "iteration":
      return { iterationId: value };
    default:
      return { text: value };
  }
}

export interface CreateIssueCommentInput {
  owner: string;
  repo: string;
  issueOrPrNumber: number;
  body: string; // DevOps:SPEC-EXT-001形式のMarkdown等
}

export interface CreateIssueInput {
  owner: string;
  repo: string;
  title: string;
  body: string;
  labels: string[];
  milestone?: number;
}

export interface CreateMilestoneInput {
  owner: string;
  repo: string;
  title: string;
  dueOn?: string;
  description?: string;
}

export interface WorkflowDispatchInput {
  owner: string;
  repo: string;
  workflowIdOrFileName: string; // 例: "deploy-prod.yml"
  ref: string; // ブランチ/タグ
  inputs: Record<string, string>;
}

/** Actions run の観測結果。`status` が完了以外なら実行中/待機中を意味する。 */
export interface WorkflowRunSummary {
  id: number;
  status: string | null;
  conclusion: string | null;
}

/** run 一覧の観測結果。`complete: false` は上限に当たり全件は見ていないことを示す。 */
export interface WorkflowRunListing {
  runs: WorkflowRunSummary[];
  complete: boolean;
}

const MAX_WORKFLOW_LOG_BYTES = 1_000_000;

async function readResponseBytes(response: Response, maxBytes: number): Promise<Buffer> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("E-DEP04: workflow artifact archive exceeds observation bound");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("E-DEP05: workflow artifact archive has no body");
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) throw new Error("E-DEP04: workflow artifact archive exceeds observation bound");
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

function readZipEntry(archive: Buffer, fileName: string, maxBytes: number): string {
  if (archive.length < 22) throw new Error("E-DEP06: malformed workflow artifact ZIP");
  const minimumEocdOffset = Math.max(0, archive.length - 65_557);
  let eocdOffset = -1;
  for (let offset = archive.length - 22; offset >= minimumEocdOffset; offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("E-DEP06: malformed workflow artifact ZIP");
  const disk = archive.readUInt16LE(eocdOffset + 4);
  const centralDisk = archive.readUInt16LE(eocdOffset + 6);
  const diskEntries = archive.readUInt16LE(eocdOffset + 8);
  const entryCount = archive.readUInt16LE(eocdOffset + 10);
  const centralSize = archive.readUInt32LE(eocdOffset + 12);
  const centralOffset = archive.readUInt32LE(eocdOffset + 16);
  const archiveCommentLength = archive.readUInt16LE(eocdOffset + 20);
  if (
    disk !== 0 ||
    centralDisk !== 0 ||
    diskEntries !== entryCount ||
    entryCount !== 1 ||
    eocdOffset + 22 + archiveCommentLength !== archive.length ||
    centralOffset + centralSize !== eocdOffset
  ) {
    throw new Error("E-DEP06: malformed workflow artifact ZIP");
  }
  let offset = centralOffset;
  let match: {
    localOffset: number;
    compressedSize: number;
    uncompressedSize: number;
    method: number;
    flags: number;
  } | null = null;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > archive.length || archive.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("E-DEP06: malformed workflow artifact ZIP");
    }
    const flags = archive.readUInt16LE(offset + 8);
    const method = archive.readUInt16LE(offset + 10);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const uncompressedSize = archive.readUInt32LE(offset + 24);
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const startDisk = archive.readUInt16LE(offset + 34);
    const externalAttributes = archive.readUInt32LE(offset + 38);
    const localOffset = archive.readUInt32LE(offset + 42);
    const nextOffset = offset + 46 + nameLength + extraLength + commentLength;
    const unixType = (externalAttributes >>> 16) & 0o170000;
    if (
      nextOffset > eocdOffset ||
      (flags & 1) !== 0 ||
      startDisk !== 0 ||
      (unixType !== 0 && unixType !== 0o100000) ||
      (externalAttributes & 0x10) !== 0
    ) {
      throw new Error("E-DEP06: malformed workflow artifact ZIP");
    }
    const name = archive.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (name === fileName) {
      if (match) throw new Error("E-DEP07: ambiguous workflow artifact file");
      match = { localOffset, compressedSize, uncompressedSize, method, flags };
    }
    offset = nextOffset;
  }
  if (offset !== eocdOffset) throw new Error("E-DEP06: malformed workflow artifact ZIP");
  if (!match) throw new Error("E-DEP08: workflow artifact file is missing");
  if ((match.method !== 0 && match.method !== 8) || match.uncompressedSize > maxBytes) {
    throw new Error("E-DEP10: workflow artifact file exceeds observation bound");
  }
  const local = match.localOffset;
  if (local + 30 > archive.length || archive.readUInt32LE(local) !== 0x04034b50) {
    throw new Error("E-DEP06: malformed workflow artifact ZIP");
  }
  const localFlags = archive.readUInt16LE(local + 6);
  const localMethod = archive.readUInt16LE(local + 8);
  const localNameLength = archive.readUInt16LE(local + 26);
  const localExtraLength = archive.readUInt16LE(local + 28);
  const dataOffset = local + 30 + localNameLength + localExtraLength;
  const dataEnd = dataOffset + match.compressedSize;
  const localName = archive.subarray(local + 30, local + 30 + localNameLength).toString("utf8");
  if (dataEnd > centralOffset || localName !== fileName || localMethod !== match.method || localFlags !== match.flags) {
    throw new Error("E-DEP06: malformed workflow artifact ZIP");
  }
  const compressed = archive.subarray(dataOffset, dataEnd);
  if (match.method === 0) {
    if (match.compressedSize !== match.uncompressedSize) {
      throw new Error("E-DEP06: malformed workflow artifact ZIP");
    }
    return compressed.toString("utf8");
  }
  try {
    const contents = inflateRawSync(compressed, { maxOutputLength: maxBytes });
    if (contents.length !== match.uncompressedSize) throw new Error("size mismatch");
    return contents.toString("utf8");
  } catch {
    throw new Error("E-DEP09: workflow artifact deflate stream is invalid");
  }
}

function truncateUtf8Tail(text: string, maxBytes: number): string {
  const bytes = Buffer.from(text, "utf8");
  if (bytes.length <= maxBytes) return text;
  let tail = bytes.subarray(bytes.length - maxBytes).toString("utf8");
  while (Buffer.byteLength(tail, "utf8") > maxBytes) tail = tail.slice(1);
  return tail;
}

async function readResponseTextTail(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  let tail = Buffer.alloc(0);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = Buffer.from(value);
    if (chunk.length >= maxBytes) {
      tail = Buffer.from(chunk.subarray(chunk.length - maxBytes));
      continue;
    }
    const previousBytesToKeep = Math.min(tail.length, maxBytes - chunk.length);
    tail = Buffer.concat([tail.subarray(tail.length - previousBytesToKeep), chunk], previousBytesToKeep + chunk.length);
  }
  return truncateUtf8Tail(tail.toString("utf8"), maxBytes);
}

export interface ProjectV2SnapshotRecord {
  projectId: string | null;
  repository: string | null;
  sourceType: "issue" | "pull_request" | "milestone" | "project_item" | "project_status";
  sourceId: string;
  state: string | null;
  payload: unknown;
}

export interface ProjectV2SnapshotPage {
  rateLimit: { remaining: number; cost?: number; resetAt?: string };
  snapshots: ProjectV2SnapshotRecord[];
  hasMore: boolean;
  nextCursor?: string | null;
}

export class GitHubClient {
  private readonly fetchImpl: GhFetchLike;
  private readonly retryOptions: RetryOptions;

  constructor(
    private readonly tokenProvider: GitHubTokenProvider,
    fetchImpl: GhFetchLike = fetch,
    private readonly baseUrl: string = "https://api.github.com",
    options: { retry?: RetryOptions; timeoutMs?: number } = {},
  ) {
    this.fetchImpl = withTimeout(fetchImpl, options.timeoutMs ?? 30_000);
    this.retryOptions = { ...options.retry, retryForbiddenWithRetryAfter: true };
  }

  private fetch(url: string, init: RequestInit): Promise<Response> {
    const method = init.method?.toUpperCase() ?? "GET";
    const policy = ["POST", "PATCH", "PUT", "DELETE"].includes(method) ? "non-idempotent" : "idempotent";
    return fetchWithBackoff(this.fetchImpl, url, init, this.retryOptions, policy);
  }

  private async headers(): Promise<Record<string, string>> {
    const token = await this.tokenProvider.getInstallationToken();
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  /** DevOps:SPEC-EXT-001 ビルド失敗PRコメント / SPEC-EXT-015 インシデントIssue本文への追記等 */
  async createIssueComment(input: CreateIssueCommentInput): Promise<void> {
    const headers = await this.headers();
    const res = await this.fetch(
      `${this.baseUrl}/repos/${input.owner}/${input.repo}/issues/${input.issueOrPrNumber}/comments`,
      { method: "POST", headers, body: JSON.stringify({ body: input.body }) },
    );
    if (!res.ok) throw new Error(`E-GEN02: createIssueComment failed with status ${res.status}`);
  }

  /** SPEC-EXT-015 インシデントIssue起票（[SevN][プロジェクトID] 事象概要, ラベル: incident/sevN/auto-triaged） */
  async createIssue(input: CreateIssueInput): Promise<{ number: number; htmlUrl: string }> {
    const headers = await this.headers();
    const res = await this.fetch(`${this.baseUrl}/repos/${input.owner}/${input.repo}/issues`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title: input.title, body: input.body, labels: input.labels, milestone: input.milestone }),
    });
    if (!res.ok) throw new Error(`E-GEN03: createIssue failed with status ${res.status}`);
    const json = (await res.json()) as { number: number; html_url: string };
    return { number: json.number, htmlUrl: json.html_url };
  }

  /**
   * DevOps:SPEC-INT-030 retry dedupe: auto-triaged Issue本文の決定的markerをbounded searchする。
   * 2件以上・partial result・応答欠落は「既存なし」に倒さず、重複起票を防ぐため失敗させる。
   */
  async findIssueByBodyMarker(
    owner: string,
    repo: string,
    marker: string,
  ): Promise<{ number: number; htmlUrl: string } | null> {
    if (!/^source-issue:[1-9]\d*$/.test(marker)) throw new Error("E-GEN05: invalid incident source marker");
    const headers = await this.headers();
    const params = new URLSearchParams({
      q: `repo:${owner}/${repo} is:issue in:body "${marker}" label:auto-triaged`,
      per_page: "2",
      page: "1",
    });
    const res = await this.fetch(`${this.baseUrl}/search/issues?${params.toString()}`, { method: "GET", headers });
    if (!res.ok) throw new Error(`E-GEN06: incident marker search failed with status ${res.status}`);
    const body = (await res.json()) as {
      total_count?: unknown;
      incomplete_results?: unknown;
      items?: unknown;
    };
    if (
      typeof body.total_count !== "number" ||
      typeof body.incomplete_results !== "boolean" ||
      !Array.isArray(body.items)
    ) {
      throw new Error("E-GEN07: malformed incident marker search response");
    }
    if (body.incomplete_results || body.total_count > 1 || body.items.length < body.total_count) {
      throw new Error("E-GEN08: incomplete or ambiguous incident marker search");
    }
    if (body.total_count === 0) return null;
    const issue = body.items[0] as Record<string, unknown> | undefined;
    if (
      !issue ||
      !Number.isSafeInteger(issue["number"]) ||
      Number(issue["number"]) <= 0 ||
      typeof issue["html_url"] !== "string" ||
      typeof issue["body"] !== "string" ||
      !issue["body"].includes(marker)
    ) {
      throw new Error("E-GEN09: malformed incident marker search item");
    }
    return { number: Number(issue["number"]), htmlUrl: issue["html_url"] };
  }

  /** REQ-037 / PrjOps:SPEC-INT-063: ExcelインポートからMilestoneを作成する。 */
  async createMilestone(input: CreateMilestoneInput): Promise<{ number: number; htmlUrl: string; nodeId?: string }> {
    const headers = await this.headers();
    const res = await this.fetch(`${this.baseUrl}/repos/${input.owner}/${input.repo}/milestones`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title: input.title, due_on: input.dueOn, description: input.description }),
    });
    if (!res.ok) throw new Error(`E-GEN04: createMilestone failed with status ${res.status}`);
    const json = (await res.json()) as { number: number; html_url: string; node_id?: string };
    return { number: json.number, htmlUrl: json.html_url, nodeId: json.node_id };
  }

  async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const headers = await this.headers();
    const res = await this.fetch(`${this.baseUrl}/graphql`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`E-GQL01: graphql failed with status ${res.status}`);
    const json = (await res.json()) as { data?: T; errors?: unknown };
    if (json.errors) throw new Error("E-GQL02: graphql returned errors");
    return json.data as T;
  }

  /** rateLimitは実行時に読む。固定ポイント値をコードに置かない（ADR-0008 / deep research）。 */
  async getGraphqlRateLimit(): Promise<{ remaining: number; resetAt: string }> {
    const data = await this.graphql<{ rateLimit: { remaining: number; resetAt: string } }>(
      "query RateLimit { rateLimit { remaining resetAt } }",
      {},
    );
    return { remaining: data.rateLimit.remaining, resetAt: data.rateLimit.resetAt };
  }

  async listCurrentProjectV2Snapshots(input: {
    projectNodeId: string;
    cursor?: string | null;
  }): Promise<ProjectV2SnapshotPage> {
    const data = await this.graphql<{
      rateLimit: { remaining: number; cost?: number; resetAt?: string };
      node?: {
        items?: {
          pageInfo: { hasNextPage: boolean; endCursor?: string | null };
          nodes: Array<Record<string, unknown>>;
        };
      };
    }>(
      `query ProjectSnapshots($projectId: ID!, $cursor: String) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: 50, after: $cursor) {
              pageInfo { hasNextPage endCursor }
              nodes {
                id
                content {
                  __typename
                  ... on Issue { id number title state repository { nameWithOwner } }
                  ... on PullRequest { id number title state repository { nameWithOwner } }
                  ... on Milestone { id title state dueOn }
                }
                fieldValues(first: 20) {
                  nodes {
                    __typename
                    ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2FieldCommon { name } } }
                    ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2FieldCommon { name } } }
                  }
                }
              }
            }
          }
        }
        rateLimit { remaining cost resetAt }
      }`,
      { projectId: input.projectNodeId, cursor: input.cursor ?? null },
    );
    const items = data.node?.items;
    const snapshots = (items?.nodes ?? []).map((item) => toProjectV2Snapshot(input.projectNodeId, item));
    return {
      rateLimit: data.rateLimit,
      snapshots,
      hasMore: items?.pageInfo.hasNextPage ?? false,
      nextCursor: items?.pageInfo.endCursor ?? null,
    };
  }

  async addProjectV2ItemById(input: { projectNodeId: string; contentNodeId: string }): Promise<{ itemNodeId: string }> {
    const data = await this.graphql<{ addProjectV2ItemById: { item: { id: string } } }>(
      `mutation AddProjectItem($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) { item { id } }
      }`,
      { projectId: input.projectNodeId, contentId: input.contentNodeId },
    );
    return { itemNodeId: data.addProjectV2ItemById.item.id };
  }

  async updateProjectV2ItemFieldValue(input: {
    projectNodeId: string;
    itemNodeId: string;
    fieldNodeId: string;
    fieldType: string;
    value: string;
  }): Promise<void> {
    await this.graphql(
      `mutation UpdateProjectItem($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $projectId,
          itemId: $itemId,
          fieldId: $fieldId,
          value: $value
        }) { projectV2Item { id } }
      }`,
      {
        projectId: input.projectNodeId,
        itemId: input.itemNodeId,
        fieldId: input.fieldNodeId,
        value: projectV2FieldValue(input.fieldType, input.value),
      },
    );
  }

  /**
   * 本番デプロイ実行（DevOps:SPEC-INT-020）。当該ワークフローは呼び出し元のGitHub App/サービスアカウントに
   * のみ実行権限が付与されるようEnvironments保護ルールで制限すること（本クライアントはAPI呼び出しのみ担当）。
   */
  async dispatchWorkflow(input: WorkflowDispatchInput): Promise<void> {
    const headers = await this.headers();
    const res = await this.fetch(
      `${this.baseUrl}/repos/${input.owner}/${input.repo}/actions/workflows/${input.workflowIdOrFileName}/dispatches`,
      { method: "POST", headers, body: JSON.stringify({ ref: input.ref, inputs: input.inputs }) },
    );
    if (!res.ok) throw new Error(`E-DEP01: workflow_dispatch failed with status ${res.status}`);
  }

  /** DevOps:REQ-010 / D-04: dispatch前に対象workflowの実在だけを確認する。404以外は観測失敗として伝播する。 */
  async workflowExists(owner: string, repo: string, workflowIdOrFileName: string): Promise<boolean> {
    const headers = await this.headers();
    const res = await this.fetch(
      `${this.baseUrl}/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowIdOrFileName)}`,
      { method: "GET", headers },
    );
    if (res.status === 404) return false;
    if (!res.ok) throw new Error(`E-DEP02: get workflow failed with status ${res.status}`);
    return true;
  }

  /**
   * TH-001: workflow run が発行したJSON evidence artifactをboundedかつ一意に読む。
   * CI側のZIPは stored/deflateの両方をboundedに扱う（artifactは`compression-level: 0`で発行）。
   */
  async readWorkflowRunJsonArtifact(
    owner: string,
    repo: string,
    runId: number,
    input: { artifactName: string; fileName: string; maxArchiveBytes: number },
  ): Promise<unknown> {
    if (
      !Number.isSafeInteger(runId) ||
      runId <= 0 ||
      !Number.isSafeInteger(input.maxArchiveBytes) ||
      input.maxArchiveBytes <= 0
    ) {
      throw new Error("E-DEP03: invalid workflow artifact request");
    }
    const headers = await this.headers();
    const list = await this.fetch(
      `${this.baseUrl}/repos/${owner}/${repo}/actions/runs/${runId}/artifacts?per_page=100&page=1`,
      { method: "GET", headers },
    );
    if (!list.ok) throw new Error(`E-DEP11: list workflow artifacts failed with status ${list.status}`);
    const body = (await list.json()) as { total_count?: unknown; artifacts?: unknown };
    if (typeof body.total_count !== "number" || !Array.isArray(body.artifacts) || body.total_count > 100) {
      throw new Error("E-DEP12: incomplete workflow artifact listing");
    }
    const matches = body.artifacts.filter((candidate) => {
      const artifact = candidate as Record<string, unknown>;
      return artifact["name"] === input.artifactName && artifact["expired"] === false;
    });
    if (matches.length !== 1) throw new Error("E-DEP13: missing or ambiguous workflow artifact");
    const artifact = matches[0] as Record<string, unknown>;
    const artifactId = artifact["id"];
    const declaredSize = artifact["size_in_bytes"];
    if (
      !Number.isSafeInteger(artifactId) ||
      Number(artifactId) <= 0 ||
      typeof declaredSize !== "number" ||
      !Number.isSafeInteger(declaredSize) ||
      declaredSize < 0 ||
      declaredSize > input.maxArchiveBytes
    ) {
      throw new Error("E-DEP14: malformed or oversized workflow artifact metadata");
    }
    const archiveResponse = await this.fetch(
      `${this.baseUrl}/repos/${owner}/${repo}/actions/artifacts/${Number(artifactId)}/zip`,
      { method: "GET", headers },
    );
    if (!archiveResponse.ok) {
      throw new Error(`E-DEP15: download workflow artifact failed with status ${archiveResponse.status}`);
    }
    const archive = await readResponseBytes(archiveResponse, input.maxArchiveBytes);
    const json = readZipEntry(archive, input.fileName, input.maxArchiveBytes);
    try {
      return JSON.parse(json) as unknown;
    } catch {
      throw new Error("E-DEP16: workflow artifact is not valid JSON");
    }
  }

  /**
   * 特定ワークフローの実行状態を観測する（DevOps:SPEC-INT-020 / ADR-0006）。
   *
   * workflow_dispatch は run ID を返さないため、dispatch した個別の run を特定できない。
   * dispatch の ref はワークフロー定義のあるブランチ（coding-task は `main`）であり、
   * ジョブが自前で作る作業ブランチは run に紐づかないので、ブランチ名も相関キーにならない。
   * そのため「このワークフローの、この時刻以降の実行」という粒度でしか観測できない。
   * 呼び出し側はその粗さを前提に、安全側（回収しない側）へ倒して使うこと。
   *
   * run は新しい順に返るため、1ページだけ読むと古い未完了の run を見落とす。
   * `total_count` に達するまでページを辿り、上限に当たったら `complete: false` を返して
   * 「全部は見ていない」ことを呼び出し側へ伝える（黙って打ち切らない）。
   */
  async listWorkflowRuns(
    owner: string,
    repo: string,
    input: {
      workflowFileName: string;
      event?: string;
      createdSince?: string;
      perPage?: number;
      maxPages?: number;
    },
  ): Promise<WorkflowRunListing> {
    const headers = await this.headers();
    const perPage = input.perPage ?? 100;
    const maxPages = input.maxPages ?? 10;
    const path = `/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(input.workflowFileName)}/runs`;
    const runs: WorkflowRunSummary[] = [];
    let totalCount = 0;

    for (let page = 1; page <= maxPages; page += 1) {
      const params = new URLSearchParams({ per_page: String(perPage), page: String(page) });
      if (input.event) params.set("event", input.event);
      if (input.createdSince) params.set("created", `>=${input.createdSince}`);
      const res = await this.fetch(`${this.baseUrl}${path}?${params.toString()}`, { method: "GET", headers });
      if (!res.ok) throw new Error(`E-ING05: listWorkflowRuns failed with status ${res.status}`);
      const body = (await res.json()) as { workflow_runs?: unknown; total_count?: unknown };
      // 形が違う応答を「run が無い」と読み替えない。呼び出し側はこれを回収の根拠にするので、
      // 壊れた応答は観測できなかったこととして扱う（complete: false）。
      if (!Array.isArray(body.workflow_runs) || typeof body.total_count !== "number") {
        return { runs, complete: false };
      }
      totalCount = body.total_count;
      const pageRuns = body.workflow_runs;
      for (const run of pageRuns) {
        const record = run as Record<string, unknown>;
        runs.push({
          id: Number(record["id"]),
          status: typeof record["status"] === "string" ? record["status"] : null,
          conclusion: typeof record["conclusion"] === "string" ? record["conclusion"] : null,
        });
      }
      if (pageRuns.length < perPage || runs.length >= totalCount) return { runs, complete: true };
    }
    return { runs, complete: runs.length >= totalCount };
  }

  /** 失敗ジョブのログ取得（SPEC-INT-011 手順2。最大1MB、超過分は末尾優先で切り詰め） */
  async getWorkflowJobLog(owner: string, repo: string, jobId: number): Promise<string> {
    const headers = await this.headers();
    const res = await this.fetch(`${this.baseUrl}/repos/${owner}/${repo}/actions/jobs/${jobId}/logs`, {
      method: "GET",
      headers,
    });
    if (!res.ok) throw new Error(`E-ING04: getWorkflowJobLog failed with status ${res.status}`);
    return readResponseTextTail(res, MAX_WORKFLOW_LOG_BYTES);
  }

  /**
   * workflow run の失敗証拠を取得する（DevOps:SPEC-INT-011 手順2）。
   *
   * run 全体の archive は redirect 先がZIPになり得る一方、job log API はplain textを返す。
   * 依存を増やさず確実に扱うため、jobs JSONで失敗job/stepを特定して個別ログを取得する。
   * 観測上限は1ページ100 jobs・失敗10 jobs・結合後1MB。上限超過を部分成功に見せず拒否する。
   */
  async getWorkflowRunFailureLog(owner: string, repo: string, runId: number): Promise<string> {
    const headers = await this.headers();
    const params = new URLSearchParams({ filter: "latest", per_page: "100", page: "1" });
    const res = await this.fetch(
      `${this.baseUrl}/repos/${owner}/${repo}/actions/runs/${runId}/jobs?${params.toString()}`,
      { method: "GET", headers },
    );
    if (!res.ok) throw new Error(`E-ING06: list workflow jobs failed with status ${res.status}`);
    const body = (await res.json()) as { total_count?: unknown; jobs?: unknown };
    if (typeof body.total_count !== "number" || !Array.isArray(body.jobs)) {
      throw new Error("E-ING07: malformed workflow jobs response");
    }
    if (body.total_count > 100 || body.jobs.length < body.total_count) {
      throw new Error("E-ING08: incomplete workflow jobs response exceeds observation bound");
    }

    const failedJobs = body.jobs.filter((job) => {
      const record = job as Record<string, unknown>;
      return record["conclusion"] === "failure";
    });
    if (failedJobs.length === 0) throw new Error("E-ING09: workflow failure has no failed job evidence");
    if (failedJobs.length > 10) throw new Error("E-ING10: failed workflow jobs exceed observation bound");

    const sections: string[] = [];
    for (const job of failedJobs) {
      const record = job as Record<string, unknown>;
      const id = record["id"];
      const name = record["name"];
      if (!Number.isSafeInteger(id) || Number(id) <= 0 || typeof name !== "string") {
        throw new Error("E-ING11: malformed failed workflow job");
      }
      const failedSteps = Array.isArray(record["steps"])
        ? record["steps"]
            .filter((step) => (step as Record<string, unknown>)["conclusion"] === "failure")
            .map((step) => (step as Record<string, unknown>)["name"])
            .filter((stepName): stepName is string => typeof stepName === "string")
        : [];
      const log = truncateUtf8Tail(
        await this.getWorkflowJobLog(owner, repo, Number(id)),
        Math.floor(900_000 / failedJobs.length),
      );
      sections.push([`Failed job: ${name}`, ...failedSteps.map((step) => `Failed step: ${step}`), "", log].join("\n"));
    }
    return truncateUtf8Tail(sections.join("\n\n"), MAX_WORKFLOW_LOG_BYTES);
  }

  /** リポジトリ/Environmentへの権限付与（DevOps AGT-SEC, DevOps:SPEC-INT-053 grants） */
  async putCollaboratorPermission(
    owner: string,
    repo: string,
    username: string,
    permission: "pull" | "push" | "maintain" | "admin",
  ): Promise<void> {
    const headers = await this.headers();
    const res = await this.fetch(`${this.baseUrl}/repos/${owner}/${repo}/collaborators/${username}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ permission }),
    });
    if (!res.ok) throw new Error(`E-SEC01: putCollaboratorPermission failed with status ${res.status}`);
  }

  async removeCollaborator(owner: string, repo: string, username: string): Promise<void> {
    const headers = await this.headers();
    const res = await this.fetch(`${this.baseUrl}/repos/${owner}/${repo}/collaborators/${username}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok && res.status !== 404) throw new Error(`E-SEC02: removeCollaborator failed with status ${res.status}`);
  }

  /** PR一覧取得（ADR-0005: Teamsチャネルからの照会コマンド gh_pr_list 用） */
  async listPullRequests(
    owner: string,
    repo: string,
    opts: { state?: "open" | "closed" | "all"; perPage?: number } = {},
  ): Promise<PullRequestSummary[]> {
    const headers = await this.headers();
    const params = new URLSearchParams({ state: opts.state ?? "open", per_page: String(opts.perPage ?? 30) });
    const res = await this.fetch(`${this.baseUrl}/repos/${owner}/${repo}/pulls?${params}`, {
      method: "GET",
      headers,
    });
    if (!res.ok) throw new Error(`E-GHR01: listPullRequests failed with status ${res.status}`);
    const json = (await res.json()) as Array<Record<string, unknown>>;
    return json.map(toPullRequestSummary);
  }

  /** PR詳細取得（マージ可否・head/base情報を含む） */
  async getPullRequest(owner: string, repo: string, number: number): Promise<PullRequestDetail> {
    const headers = await this.headers();
    const res = await this.fetch(`${this.baseUrl}/repos/${owner}/${repo}/pulls/${number}`, {
      method: "GET",
      headers,
    });
    if (!res.ok) throw new Error(`E-GHR02: getPullRequest failed with status ${res.status}`);
    const raw = (await res.json()) as Record<string, unknown>;
    return {
      ...toPullRequestSummary(raw),
      body: String(raw.body ?? ""),
      mergeable: (raw.mergeable as boolean | null) ?? null,
      baseRef: String((raw.base as Record<string, unknown> | undefined)?.ref ?? ""),
      changedFiles: Number(raw.changed_files ?? 0),
      additions: Number(raw.additions ?? 0),
      deletions: Number(raw.deletions ?? 0),
    };
  }

  /** Issue一覧取得（ADR-0005: 照会コマンド用。GitHubのissues APIはPRも含むためpull_requestキーで除外する） */
  async listIssues(
    owner: string,
    repo: string,
    opts: { state?: "open" | "closed" | "all"; labels?: string[]; perPage?: number } = {},
  ): Promise<IssueSummary[]> {
    const headers = await this.headers();
    const params = new URLSearchParams({ state: opts.state ?? "open", per_page: String(opts.perPage ?? 30) });
    if (opts.labels?.length) params.set("labels", opts.labels.join(","));
    const res = await this.fetch(`${this.baseUrl}/repos/${owner}/${repo}/issues?${params}`, {
      method: "GET",
      headers,
    });
    if (!res.ok) throw new Error(`E-GHR03: listIssues failed with status ${res.status}`);
    const json = (await res.json()) as Array<Record<string, unknown>>;
    return json
      .filter((raw) => raw.pull_request === undefined)
      .map((raw) => ({
        number: Number(raw.number),
        title: String(raw.title ?? ""),
        state: (raw.state === "closed" ? "closed" : "open") as "open" | "closed",
        labels: Array.isArray(raw.labels)
          ? (raw.labels as Array<Record<string, unknown>>).map((l) => String(l.name ?? ""))
          : [],
        author: String((raw.user as Record<string, unknown> | undefined)?.login ?? ""),
        url: String(raw.html_url ?? ""),
        createdAt: String(raw.created_at ?? ""),
        updatedAt: String(raw.updated_at ?? ""),
      }));
  }
}

export interface PullRequestSummary {
  number: number;
  title: string;
  state: "open" | "closed";
  draft: boolean;
  author: string;
  headRef: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  merged: boolean;
}

export interface PullRequestDetail extends PullRequestSummary {
  body: string;
  mergeable: boolean | null;
  baseRef: string;
  changedFiles: number;
  additions: number;
  deletions: number;
}

export interface IssueSummary {
  number: number;
  title: string;
  state: "open" | "closed";
  labels: string[];
  author: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

function toPullRequestSummary(raw: Record<string, unknown>): PullRequestSummary {
  return {
    number: Number(raw.number),
    title: String(raw.title ?? ""),
    state: (raw.state === "closed" ? "closed" : "open") as "open" | "closed",
    draft: Boolean(raw.draft),
    author: String((raw.user as Record<string, unknown> | undefined)?.login ?? ""),
    headRef: String((raw.head as Record<string, unknown> | undefined)?.ref ?? ""),
    url: String(raw.html_url ?? ""),
    createdAt: String(raw.created_at ?? ""),
    updatedAt: String(raw.updated_at ?? ""),
    merged: raw.merged === true || raw.merged_at != null,
  };
}

function fieldName(field: unknown): string {
  return String((field as Record<string, unknown> | undefined)?.name ?? "");
}

function statusFromFieldValues(fieldValues: unknown): string | null {
  const nodes = (fieldValues as { nodes?: Array<Record<string, unknown>> } | undefined)?.nodes ?? [];
  const status = nodes.find((node) => fieldName(node.field).toLowerCase() === "status");
  if (!status) return null;
  return typeof status.name === "string" ? status.name : typeof status.text === "string" ? status.text : null;
}

function toProjectV2Snapshot(projectId: string, item: Record<string, unknown>): ProjectV2SnapshotRecord {
  const content = (item.content as Record<string, unknown> | null | undefined) ?? undefined;
  const typeName = String(content?.__typename ?? "");
  const sourceType =
    typeName === "Issue"
      ? "issue"
      : typeName === "PullRequest"
        ? "pull_request"
        : typeName === "Milestone"
          ? "milestone"
          : "project_item";
  const repository = (content?.repository as Record<string, unknown> | undefined)?.nameWithOwner;
  return {
    projectId,
    repository: typeof repository === "string" ? repository : null,
    sourceType,
    sourceId: String(content?.id ?? item.id),
    state: statusFromFieldValues(item.fieldValues) ?? (typeof content?.state === "string" ? content.state : null),
    payload: item,
  };
}
