/**
 * packages/shared/src/clients/githubClient.ts
 *
 * 根拠:
 *   - DevOps REQ-025 GitHub連携: リポジトリイベント(push, workflow_run, PR)をWebhookで受信し、
 *     Issue/PRコメント・デプロイをGitHub API経由で実行する（AC-025aはSPEC-INT-010のディスパッチ
 *     60秒以内要件、本クライアントはそのAPI呼び出し部分を担当）。
 *   - PrjOps SPEC-EXT-003 / REQ-004(c): GitHub構造化ファイルのコミット/PR受付。
 *   - DevOps SPEC-INT-061: GitHub App認証（installation token）。Webhook購読: push, pull_request,
 *     workflow_run, issues。API操作: Issue/PRコメント作成、workflow_dispatch、権限付与API、監査ログ取得。
 *   - DevOps SPEC-INT-020: 本番デプロイ実行はGitHub Actionsのdeploy-prodワークフローを
 *     workflow_dispatchで起動する方式。当該ワークフローはエージェントのサービスアカウントのみが
 *     起動できるようGitHub Environments保護ルールで制限する（AC-010a）。
 *   - REQ-033: 正本リポジトリへの書込はエージェント用マシンアカウントとPRF-03のみ。
 *
 * Webhook署名検証: GitHubはWebhookペイロードに対しHMAC-SHA256署名（X-Hub-Signature-256）を付与する。
 * 受信側での検証はGitHub公式ドキュメントが必須のセキュリティ対策として明記しており、本クライアントは
 * タイミング攻撃対策済みの定数時間比較（crypto.timingSafeEqual）で検証する。
 */
import { createHmac, timingSafeEqual } from "node:crypto";

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

export interface CreateIssueCommentInput {
  owner: string;
  repo: string;
  issueOrPrNumber: number;
  body: string; // SPEC-EXT-001形式のMarkdown等
}

export interface CreateIssueInput {
  owner: string;
  repo: string;
  title: string;
  body: string;
  labels: string[];
  milestone?: string;
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

export class GitHubClient {
  constructor(
    private readonly tokenProvider: GitHubTokenProvider,
    private readonly fetchImpl: GhFetchLike = fetch,
    private readonly baseUrl: string = "https://api.github.com",
  ) {}

  private async headers(): Promise<Record<string, string>> {
    const token = await this.tokenProvider.getInstallationToken();
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  /** SPEC-EXT-001 ビルド失敗PRコメント / SPEC-EXT-015 インシデントIssue本文への追記等 */
  async createIssueComment(input: CreateIssueCommentInput): Promise<void> {
    const headers = await this.headers();
    const res = await this.fetchImpl(
      `${this.baseUrl}/repos/${input.owner}/${input.repo}/issues/${input.issueOrPrNumber}/comments`,
      { method: "POST", headers, body: JSON.stringify({ body: input.body }) },
    );
    if (!res.ok) throw new Error(`E-GEN02: createIssueComment failed with status ${res.status}`);
  }

  /** SPEC-EXT-015 インシデントIssue起票（[SevN][プロジェクトID] 事象概要, ラベル: incident/sevN/auto-triaged） */
  async createIssue(input: CreateIssueInput): Promise<{ number: number; htmlUrl: string }> {
    const headers = await this.headers();
    const res = await this.fetchImpl(`${this.baseUrl}/repos/${input.owner}/${input.repo}/issues`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title: input.title, body: input.body, labels: input.labels, milestone: input.milestone }),
    });
    if (!res.ok) throw new Error(`E-GEN03: createIssue failed with status ${res.status}`);
    const json = (await res.json()) as { number: number; html_url: string };
    return { number: json.number, htmlUrl: json.html_url };
  }

  /** REQ-037 / SPEC-INT-063: ExcelインポートからMilestoneを作成する。 */
  async createMilestone(input: CreateMilestoneInput): Promise<{ number: number; htmlUrl: string; nodeId?: string }> {
    const headers = await this.headers();
    const res = await this.fetchImpl(`${this.baseUrl}/repos/${input.owner}/${input.repo}/milestones`, {
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
    const res = await this.fetchImpl(`${this.baseUrl}/graphql`, {
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
      `mutation UpdateProjectItem($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: String!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $projectId,
          itemId: $itemId,
          fieldId: $fieldId,
          value: { text: $value }
        }) { projectV2Item { id } }
      }`,
      {
        projectId: input.projectNodeId,
        itemId: input.itemNodeId,
        fieldId: input.fieldNodeId,
        value: input.value,
        fieldType: input.fieldType,
      },
    );
  }

  /**
   * 本番デプロイ実行（SPEC-INT-020）。当該ワークフローは呼び出し元のGitHub App/サービスアカウントに
   * のみ実行権限が付与されるようEnvironments保護ルールで制限すること（本クライアントはAPI呼び出しのみ担当）。
   */
  async dispatchWorkflow(input: WorkflowDispatchInput): Promise<void> {
    const headers = await this.headers();
    const res = await this.fetchImpl(
      `${this.baseUrl}/repos/${input.owner}/${input.repo}/actions/workflows/${input.workflowIdOrFileName}/dispatches`,
      { method: "POST", headers, body: JSON.stringify({ ref: input.ref, inputs: input.inputs }) },
    );
    if (!res.ok) throw new Error(`E-DEP01: workflow_dispatch failed with status ${res.status}`);
  }

  /** 失敗ジョブのログ取得（SPEC-INT-011 手順2。最大1MB、超過分は末尾優先で切り詰め） */
  async getWorkflowJobLog(owner: string, repo: string, jobId: number): Promise<string> {
    const headers = await this.headers();
    const res = await this.fetchImpl(`${this.baseUrl}/repos/${owner}/${repo}/actions/jobs/${jobId}/logs`, {
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

  /** リポジトリ/Environmentへの権限付与（DevOps AGT-SEC, SPEC-INT-053 grants） */
  async putCollaboratorPermission(
    owner: string,
    repo: string,
    username: string,
    permission: "pull" | "push" | "maintain" | "admin",
  ): Promise<void> {
    const headers = await this.headers();
    const res = await this.fetchImpl(`${this.baseUrl}/repos/${owner}/${repo}/collaborators/${username}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ permission }),
    });
    if (!res.ok) throw new Error(`E-SEC01: putCollaboratorPermission failed with status ${res.status}`);
  }

  async removeCollaborator(owner: string, repo: string, username: string): Promise<void> {
    const headers = await this.headers();
    const res = await this.fetchImpl(`${this.baseUrl}/repos/${owner}/${repo}/collaborators/${username}`, {
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
    const res = await this.fetchImpl(`${this.baseUrl}/repos/${owner}/${repo}/pulls?${params}`, {
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
    const res = await this.fetchImpl(`${this.baseUrl}/repos/${owner}/${repo}/pulls/${number}`, {
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
    const res = await this.fetchImpl(`${this.baseUrl}/repos/${owner}/${repo}/issues?${params}`, {
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
