/**
 * packages/server/src/tools/createGraphSubscription.ts
 *
 * 根拠: ADR-0014 / REQ-042 / SPEC-INT-069。
 * Graph change notification購読を既存GraphTokenProvider/GraphClientで作成する管理CLI。
 */
import { GraphClient } from "@aiops/shared";
import { loadConfig } from "../config.js";
import { createPool } from "../db/pool.js";
import { GraphSubscriptionsRepo } from "../db/graphSubscriptionsRepo.js";
import { createClientCredentialsTokenProvider } from "../auth/graphTokenProvider.js";

export interface CreateSubscriptionCliArgs {
  resource: string;
  notificationUrl: string;
  expiry: string;
}

export function parseCreateSubscriptionArgs(argv: string[]): CreateSubscriptionCliArgs {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith("--") || !value)
      throw new Error("usage: --resource <path> --notificationUrl <url> --expiry <iso>");
    args.set(key.slice(2), value);
  }
  const resource = args.get("resource");
  const notificationUrl = args.get("notificationUrl");
  const expiry = args.get("expiry");
  if (!resource || !notificationUrl || !expiry) {
    throw new Error("usage: --resource <path> --notificationUrl <url> --expiry <iso>");
  }
  return { resource, notificationUrl, expiry };
}

export async function createGraphSubscriptionFromCliArgs(
  args: CreateSubscriptionCliArgs,
  client: Pick<GraphClient, "createSubscription">,
  clientState: string,
  repo?: Pick<GraphSubscriptionsRepo, "upsert">,
): Promise<{ id: string }> {
  const result = await client.createSubscription(args.resource, args.notificationUrl, args.expiry, {
    clientState,
    changeType: "created,updated,deleted",
  });
  await repo?.upsert({
    subscriptionId: result.id,
    resource: args.resource,
    expiresAt: args.expiry,
    mode: "notification",
  });
  return result;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const args = parseCreateSubscriptionArgs(process.argv.slice(2));
  const tokenProvider = createClientCredentialsTokenProvider({
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
      new GraphClient(tokenProvider),
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
