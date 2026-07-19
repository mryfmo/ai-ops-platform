/**
 * packages/devops/src/tools/backfillRecipients.ts
 *
 * 根拠: P010-F02-T04 / DEC-SPEC-002 / DevOps:SPEC-INT-054。
 * Signed mappingのpure検証結果をPostgreSQL transactionへ結線する管理CLI。
 */
import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";
import {
  MappingError,
  parseSignedMapping,
  planRecipientBackfill,
  type BackfillSummary,
  type MappingArtifact,
  type RecipientBackfillRow,
} from "../lib/recipientBackfill.js";

const { Pool } = pg;
const SHA256 = /^[0-9a-f]{64}$/;

interface BackfillClient {
  query(text: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number | null }>;
  release(err?: Error): void;
}

export interface BackfillPool {
  connect(): Promise<BackfillClient>;
}

export interface ExecuteBackfillOptions {
  operation: "dry-run" | "apply";
  dryRunDigest: string;
  expectedDigest?: string;
  sandboxConfirmed?: boolean;
}

export interface BackfillResult extends BackfillSummary {
  operation: "dry-run" | "apply";
  digest: string;
  applied: number;
}

export interface BackfillCliArgs {
  operation: "dry-run" | "apply";
  mappingPath: string;
  publicKeyPath: string;
  signingKeyId: string;
  tenantId: string;
  repositoryId: number;
  repositoryNodeId: string;
  commitSha: string;
  expectedDigest?: string;
  sandboxDatabase?: string;
}

function error(code: "E-MAPPING-ENV" | "E-MAPPING-DIGEST" | "E-MAPPING-UNRESOLVED", message: string): never {
  throw new MappingError(code, message);
}

function recipientRows(rows: Array<Record<string, unknown>>): RecipientBackfillRow[] {
  return rows.map((row) => ({
    user_id: String(row.user_id),
    active: row.active === true,
    entra_tenant_id: row.entra_tenant_id === null ? null : String(row.entra_tenant_id),
    entra_object_id: row.entra_object_id === null ? null : String(row.entra_object_id),
    backfill_disposition: row.backfill_disposition === null ? null : String(row.backfill_disposition),
    backfill_state: String(row.backfill_state),
  }));
}

export function assertSandboxDatabase(databaseUrl: string, confirmation: string): string {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return error("E-MAPPING-ENV", "DATABASE_URL is invalid");
  }
  const database = decodeURIComponent(url.pathname.slice(1));
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "55432" ||
    url.search !== "" ||
    url.hash !== "" ||
    !database ||
    database.includes("/") ||
    confirmation !== database
  ) {
    return error("E-MAPPING-ENV", "apply requires exact localhost:55432 sandbox database confirmation");
  }
  return database;
}

export async function executeRecipientBackfill(
  pool: BackfillPool,
  artifact: MappingArtifact,
  options: ExecuteBackfillOptions,
): Promise<BackfillResult> {
  if (options.operation === "apply" && !options.sandboxConfirmed) {
    return error("E-MAPPING-ENV", "apply requires explicit sandbox database confirmation");
  }
  const client = await pool.connect();
  try {
    await client.query(
      options.operation === "apply" ? "BEGIN" : "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    if (options.operation === "apply") {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('recipients_stable_subject_backfill'))");
    }
    const ids = artifact.entries.map((entry) => entry.legacy_record_id);
    const objects = artifact.entries.map((entry) => entry.entra_object_id);
    const selected = await client.query(
      `SELECT user_id, active, entra_tenant_id, entra_object_id, backfill_disposition, backfill_state
       FROM recipients
       WHERE user_id = ANY($1::text[])
          OR (entra_tenant_id = $2::uuid AND entra_object_id = ANY($3::uuid[]))
       ${options.operation === "apply" ? "FOR UPDATE" : ""}`,
      [ids, artifact.environment.configured_tenant_id, objects],
    );
    const plan = planRecipientBackfill(artifact, recipientRows(selected.rows));
    const activeEmailOnly = await client.query(
      `SELECT count(*) AS active_email_only
       FROM recipients
       WHERE active = true AND (entra_tenant_id IS NULL OR entra_object_id IS NULL)`,
    );
    if (Number(activeEmailOnly.rows[0]?.active_email_only ?? 0) !== 0) {
      return error("E-MAPPING-UNRESOLVED", "active email-only recipient remains");
    }
    if (options.operation === "apply") {
      if (
        !options.expectedDigest ||
        !SHA256.test(options.expectedDigest) ||
        options.expectedDigest !== options.dryRunDigest
      ) {
        return error("E-MAPPING-DIGEST", "apply input differs from the accepted dry-run bytes");
      }
      for (const entry of plan.updates) {
        const updated = await client.query(
          `UPDATE recipients
           SET entra_tenant_id = $2::uuid,
               entra_object_id = $3::uuid,
               active = $4,
               backfill_disposition = $5,
               backfill_state = 'applied'
           WHERE user_id = $1
             AND backfill_state = 'pending'
             AND active = false
             AND entra_tenant_id IS NULL
             AND entra_object_id IS NULL
           RETURNING user_id`,
          [
            entry.legacy_record_id,
            entry.entra_tenant_id,
            entry.entra_object_id,
            entry.disposition === "migrate_active",
            entry.disposition,
          ],
        );
        if (updated.rowCount !== 1)
          return error("E-MAPPING-UNRESOLVED", `recipient changed: ${entry.legacy_record_id}`);
      }
    }
    await client.query("COMMIT");
    return {
      operation: options.operation,
      digest: options.dryRunDigest,
      ...plan.summary,
      applied: options.operation === "apply" ? plan.updates.length : 0,
    };
  } catch (cause) {
    await client.query("ROLLBACK");
    throw cause;
  } finally {
    client.release();
  }
}

export function parseBackfillArgs(argv: string[]): BackfillCliArgs {
  const operation = argv[0];
  if (operation !== "dry-run" && operation !== "apply") {
    throw new Error("usage: dry-run|apply --mapping <path> --public-key <path> ...");
  }
  const values = new Map<string, string>();
  const allowed = new Set([
    "mapping",
    "public-key",
    "signing-key-id",
    "tenant-id",
    "repository-id",
    "repository-node-id",
    "commit-sha",
    "dry-run-digest",
    "confirm-sandbox-database",
  ]);
  const rest = argv.slice(1);
  if (rest.length % 2 !== 0) throw new Error("arguments must be --name value pairs");
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith("--") || !value || value.startsWith("--")) throw new Error("invalid argument");
    const name = key.slice(2);
    if (!allowed.has(name) || values.has(name)) throw new Error(`unknown or duplicate argument: ${key}`);
    values.set(name, value);
  }
  const required = [
    "mapping",
    "public-key",
    "signing-key-id",
    "tenant-id",
    "repository-id",
    "repository-node-id",
    "commit-sha",
  ];
  if (required.some((name) => !values.get(name))) throw new Error("required backfill argument is missing");
  const repositoryId = Number(values.get("repository-id"));
  if (!Number.isSafeInteger(repositoryId) || repositoryId < 1) throw new Error("repository-id must be positive");
  const expectedDigest = values.get("dry-run-digest");
  const sandboxDatabase = values.get("confirm-sandbox-database");
  if (operation === "apply" && (!expectedDigest || !sandboxDatabase)) {
    throw new Error("apply requires --dry-run-digest and --confirm-sandbox-database");
  }
  if (operation === "dry-run" && (expectedDigest || sandboxDatabase)) {
    throw new Error("dry-run does not accept apply confirmation arguments");
  }
  return {
    operation,
    mappingPath: values.get("mapping")!,
    publicKeyPath: values.get("public-key")!,
    signingKeyId: values.get("signing-key-id")!,
    tenantId: values.get("tenant-id")!,
    repositoryId,
    repositoryNodeId: values.get("repository-node-id")!,
    commitSha: values.get("commit-sha")!,
    expectedDigest,
    sandboxDatabase,
  };
}

async function main(): Promise<void> {
  const args = parseBackfillArgs(process.argv.slice(2));
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const raw = readFileSync(args.mappingPath);
  const extension = extname(args.mappingPath).toLowerCase();
  if (extension !== ".json" && extension !== ".csv") throw new MappingError("E-MAPPING-SCHEMA", "use .json or .csv");
  const parsed = parseSignedMapping(raw, extension === ".json" ? "json" : "csv", {
    configuredTenantId: args.tenantId,
    sourceRepositoryId: args.repositoryId,
    sourceRepositoryNodeId: args.repositoryNodeId,
    sourceCommitSha: args.commitSha,
    signingKeyId: args.signingKeyId,
    publicKeyPem: readFileSync(args.publicKeyPath, "utf8"),
  });
  const sandboxConfirmed =
    args.operation === "apply" && args.sandboxDatabase
      ? assertSandboxDatabase(databaseUrl, args.sandboxDatabase) === args.sandboxDatabase
      : false;
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const result = await executeRecipientBackfill(pool, parsed.artifact, {
      operation: args.operation,
      dryRunDigest: parsed.dryRunDigest,
      expectedDigest: args.expectedDigest,
      sandboxConfirmed,
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((cause) => {
    process.stderr.write(`${cause instanceof Error ? cause.message : String(cause)}\n`);
    process.exitCode = 1;
  });
}
