/**
 * packages/server/src/tools/requeueDeadEvent.ts
 *
 * 根拠: DevOps:SPEC-INT-010 / ADV-OPS-008。dead eventを監査付きrepository経路で再投入する管理CLI。
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { EventsRepo, type RequeuedDeadEvent } from "../db/eventsRepo.js";
import { createPool } from "../db/pool.js";
import { normalizeAuditActor } from "../lib/auditActor.js";

export interface RequeueDeadCliArgs {
  eventId: string;
  actor: string;
  reason: string;
}

const databaseConfigSchema = z.object({
  DATABASE_URL: z.string().trim().min(1),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
  DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  DB_IDLE_IN_TRANSACTION_SESSION_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
});

export function loadRequeueDeadDatabaseConfig(env: Record<string, string | undefined> = process.env) {
  const config = databaseConfigSchema.parse(env);
  return {
    databaseUrl: config.DATABASE_URL,
    max: config.DB_POOL_MAX,
    connectionTimeoutMillis: config.DB_POOL_CONNECTION_TIMEOUT_MS,
    statementTimeoutMs: config.DB_STATEMENT_TIMEOUT_MS,
    idleInTransactionSessionTimeoutMs: config.DB_IDLE_IN_TRANSACTION_SESSION_TIMEOUT_MS,
  };
}

export function parseRequeueDeadArgs(argv: string[]): RequeueDeadCliArgs {
  const usage = "usage: --eventId <uuid> --actor <operator-id> --reason <ticket-and-resolution>";
  if (argv.length % 2 !== 0) throw new Error(`${usage}; missing or extra arguments`);
  const allowed = new Set(["eventId", "actor", "reason"]);
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
  const eventId = args.get("eventId");
  const actor = args.get("actor");
  const reason = args.get("reason");
  if (!eventId || !actor || !reason) throw new Error(`${usage}; arguments must be nonblank`);
  return { eventId, actor: normalizeAuditActor(actor), reason };
}

export async function requeueDeadEventFromCliArgs(
  args: RequeueDeadCliArgs,
  repo: Pick<EventsRepo, "requeueDead">,
  traceIdProvider: () => string = randomUUID,
): Promise<RequeuedDeadEvent & { traceId: string }> {
  const traceId = traceIdProvider();
  const event = await repo.requeueDead(args.eventId, {
    actor: args.actor,
    reason: args.reason,
    traceId,
  });
  if (!event) throw new Error("event is not dead or does not exist");
  return { ...event, traceId };
}

async function main(): Promise<void> {
  const args = parseRequeueDeadArgs(process.argv.slice(2));
  const config = loadRequeueDeadDatabaseConfig();
  const pool = createPool(config.databaseUrl, config);
  try {
    const result = await requeueDeadEventFromCliArgs(args, new EventsRepo(pool));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("requeueDeadEvent.js")) {
  main().catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
