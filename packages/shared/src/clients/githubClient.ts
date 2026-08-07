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
      totalCount = typeof body.total_count === "number" ? body.total_count : runs.length;
      const pageRuns = Array.isArray(body.workflow_runs) ? body.workflow_runs : [];
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
    const text = await res.text();
    const MAX_BYTES = 1_000_000;
    if (Buffer.byteLength(text, "utf8") <= MAX_BYTES) return text;
    // 末尾優先で切り詰め（SPEC-INT-011）
    return text.slice(-MAX_BYTES);
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
