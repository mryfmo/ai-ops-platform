/**
 * packages/server/src/tools/createGraphSubscription.ts
 *
 * 根拠: ADR-0014 / PrjOps:REQ-042 / SPEC-INT-069。
 * Graph change notification購読を既存GraphTokenProvider/GraphClientで作成する管理CLI。
 */
import { GraphClient, isAbsoluteHttpsUrl, type FetchLike, type GraphTokenProvider } from "@aiops/shared";
import { loadConfig, type ServerConfig } from "../config.js";
import { createPool } from "../db/pool.js";
import { GraphSubscriptionsRepo } from "../db/graphSubscriptionsRepo.js";
import { createMsalGraphTokenProvider } from "../auth/graphTokenProvider.js";
import {
  buildGraphChatMessageResource,
  computeGraphSubscriptionExpiration,
  validateGraphSubscriptionExpiration,
} from "../lib/graphSubscriptionPolicy.js";

export interface CreateSubscriptionCliArgs {
  teamId: string;
  channelId: string;
  notificationUrl: string;
}

export function createGraphSubscriptionClient(
  tokenProvider: GraphTokenProvider,
  config: Pick<ServerConfig, "GRAPH_ALLOWED_TEAM_IDS" | "GRAPH_ALLOWED_FROM_MAILBOXES">,
  fetchImpl: FetchLike = fetch,
): GraphClient {
  return new GraphClient(tokenProvider, fetchImpl, undefined, undefined, undefined, {
    allowedTeamIds: config.GRAPH_ALLOWED_TEAM_IDS,
    allowedFromMailboxes: config.GRAPH_ALLOWED_FROM_MAILBOXES,
  });
}

export function parseCreateSubscriptionArgs(argv: string[]): CreateSubscriptionCliArgs {
  const usage = "usage: --teamId <id> --channelId <id> --notificationUrl <https-url>";
  if (argv.length % 2 !== 0) throw new Error(`${usage}; missing or extra arguments`);
  const allowed = new Set(["teamId", "channelId", "notificationUrl"]);
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith("--") || !value || value.startsWith("--")) throw new Error(usage);
    const name = key.slice(2);
    if (!allowed.has(name)) throw new Error(`unknown argument: ${key}`);
    if (args.has(name)) throw new Error(`duplicate argument: ${key}`);
    args.set(name, value.trim());
  }
  if (args.size !== 3) throw new Error(`${usage}; missing or extra arguments`);
  const teamId = args.get("teamId");
  const channelId = args.get("channelId");
  const notificationUrl = args.get("notificationUrl");
  if (!teamId || !channelId || !notificationUrl) throw new Error(`${usage}; missing argument`);
  if (!isAbsoluteHttpsUrl(notificationUrl)) throw new Error("notificationUrl must be an absolute HTTPS URL");
  return { teamId, channelId, notificationUrl };
}

export async function createGraphSubscriptionFromCliArgs(
  args: CreateSubscriptionCliArgs,
  client: Pick<GraphClient, "createSubscription">,
  clientState: string,
  repo?: Pick<GraphSubscriptionsRepo, "upsert">,
  now: Date = new Date(),
): Promise<{ id: string; expirationDateTime: string }> {
  const resource = buildGraphChatMessageResource(args.teamId, args.channelId);
  if (!isAbsoluteHttpsUrl(args.notificationUrl)) throw new Error("notificationUrl must be an absolute HTTPS URL");
  if (!clientState?.trim()) throw new Error("clientState must be nonblank");
  const expiry = computeGraphSubscriptionExpiration(now);
  const result = await client.createSubscription(resource, args.notificationUrl.trim(), expiry, {
    clientState,
    changeType: "created,updated,deleted",
    lifecycleNotificationUrl: args.notificationUrl.trim(),
  });
  validateGraphSubscriptionExpiration(result.expirationDateTime, now);
  await repo?.upsert({
    subscriptionId: result.id,
    resource,
    teamId: args.teamId.trim(),
    channelId: args.channelId.trim(),
    expiresAt: result.expirationDateTime,
    mode: "notification",
  });
  return result;
}

async function main(): Promise<void> {
  const args = parseCreateSubscriptionArgs(process.argv.slice(2));
  const config = loadConfig();
  const tokenProvider = createMsalGraphTokenProvider({
    tenantId: config.GRAPH_TENANT_ID,
    clientId: config.GRAPH_CLIENT_ID,
    clientSecret: config.GRAPH_CLIENT_SECRET,
  });
  const pool = createPool(config.DATABASE_URL, {
    max: config.DB_POOL_MAX,
    connectionTimeoutMillis: config.DB_POOL_CONNECTION_TIMEOUT_MS,
    statementTimeoutMs: config.DB_STATEMENT_TIMEOUT_MS,
    idleInTransactionSessionTimeoutMs: config.DB_IDLE_IN_TRANSACTION_SESSION_TIMEOUT_MS,
  });
  try {
    const result = await createGraphSubscriptionFromCliArgs(
      args,
      createGraphSubscriptionClient(tokenProvider, config),
      config.GRAPH_CLIENT_STATE,
      new GraphSubscriptionsRepo(pool),
    );
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("createGraphSubscription.js")) {
  main().catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
