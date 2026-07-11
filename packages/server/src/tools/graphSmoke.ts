/**
 * 根拠: ADR-0005 / REQ-042 / SPEC-INT-069。
 * Fail-closed Microsoft Graph sandbox smoke harness.
 * Real Graph/tenant adapters stay outside this networkless orchestration core.
 */
import { createHash, randomUUID } from "node:crypto";
import { link, lstat, realpath, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, normalize } from "node:path";
import type { GraphAccessPolicy } from "@aiops/shared";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HTTP_DATE =
  /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;

export interface GraphSmokeArgs {
  sandbox: true;
  teamId: string;
  channelId: string;
  senderMailbox: string;
  recipient: string;
  notificationUrl: string;
  lifecycleNotificationUrl: string;
  evidencePath: string;
}

export interface GraphSmokeAccessPolicy extends GraphAccessPolicy {
  expectedNotificationUrl: string;
  expectedLifecycleNotificationUrl: string;
  expectedEvidenceRoot: string;
}

export interface GraphSmokeRequestMetadata {
  clientRequestId: string;
  requestId: string;
  date: string;
  status: number;
}

export interface GraphSmokeOperations {
  createSubscription(args: GraphSmokeArgs): Promise<{
    subscriptionId: unknown;
    metadata: GraphSmokeRequestMetadata;
  }>;
  sendMail(args: GraphSmokeArgs): Promise<GraphSmokeRequestMetadata>;
  postTeamsMessage(args: GraphSmokeArgs): Promise<{ messageId: string; metadata: GraphSmokeRequestMetadata }>;
  verifyCreatedNotification(args: GraphSmokeArgs, messageId: string): Promise<GraphSmokeRequestMetadata>;
  verifyLifecycleNotification(args: GraphSmokeArgs, subscriptionId: string): Promise<GraphSmokeRequestMetadata>;
  countCorrelatedDbEvents(
    args: GraphSmokeArgs,
    correlation: { subscriptionId: string; messageId: string; clientRequestIds: string[] },
  ): Promise<number>;
  /** Adapter implementations must reject unsafe IDs before any network call. */
  deleteSubscription(subscriptionId: unknown, teamId: string): Promise<GraphSmokeRequestMetadata>;
}

export interface GraphSmokeEvidence {
  schemaVersion: "1.0";
  status: {
    sandbox: "passed" | "failed";
    cleanup: "not_required" | "passed" | "failed";
    updatedDeletedReceipt: "pending_delegated_or_ui_tenant_phase";
  };
  durationMs: number;
  graphRequests: GraphSmokeRequestMetadata[];
  dbEventCount: number;
  resourceRefs: Record<string, string>;
}

const ARGUMENTS = [
  "teamId",
  "channelId",
  "senderMailbox",
  "recipient",
  "notificationUrl",
  "lifecycleNotificationUrl",
  "evidencePath",
] as const;

function isCanonicalIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 256 &&
    value === value.trim() &&
    ![...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  );
}

function isCanonicalMailbox(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 320 &&
    value === value.trim().toLowerCase() &&
    /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
      value,
    )
  );
}

function isCanonicalHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2_048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.hash && url.toString() === value;
  } catch {
    return false;
  }
}

function validateArgs(args: GraphSmokeArgs, policy?: GraphSmokeAccessPolicy): void {
  if (args.sandbox !== true) throw new Error("E-SMK01: --sandbox is required");
  if (!isCanonicalIdentifier(args.teamId)) throw new Error("E-SMK02: teamId must be canonical");
  if (!isCanonicalIdentifier(args.channelId)) throw new Error("E-SMK02: channelId must be canonical");
  if (!isCanonicalMailbox(args.senderMailbox)) throw new Error("E-SMK02: senderMailbox must be canonical");
  if (!isCanonicalMailbox(args.recipient)) throw new Error("E-SMK02: recipient must be canonical");
  if (!isCanonicalHttpsUrl(args.notificationUrl)) throw new Error("E-SMK02: notificationUrl must be canonical HTTPS");
  if (!isCanonicalHttpsUrl(args.lifecycleNotificationUrl))
    throw new Error("E-SMK02: lifecycleNotificationUrl must be canonical HTTPS");
  if (
    typeof args.evidencePath !== "string" ||
    args.evidencePath.length > 4_096 ||
    !isAbsolute(args.evidencePath) ||
    normalize(args.evidencePath) !== args.evidencePath ||
    extname(args.evidencePath) !== ".json"
  )
    throw new Error("E-SMK02: evidencePath must be an absolute canonical JSON path");
  if (!policy) return;
  if (
    !isAbsolute(policy.expectedEvidenceRoot) ||
    normalize(policy.expectedEvidenceRoot) !== policy.expectedEvidenceRoot ||
    dirname(args.evidencePath) !== policy.expectedEvidenceRoot
  )
    throw new Error("E-SMK03: evidence path must be a direct child of the expected root");
  const teams = new Set(policy.allowedTeamIds.map((value) => value.trim()).filter((value) => value && value !== "*"));
  const mailboxes = new Set(
    policy.allowedFromMailboxes.map((value) => value.trim().toLowerCase()).filter((value) => value && value !== "*"),
  );
  if (!teams.has(args.teamId)) throw new Error("E-SMK03: team is not allowed");
  if (!mailboxes.has(args.senderMailbox)) throw new Error("E-SMK03: sender mailbox is not allowed");
  if (!mailboxes.has(args.recipient)) throw new Error("E-SMK03: recipient mailbox is not allowed");
  if (args.notificationUrl !== policy.expectedNotificationUrl)
    throw new Error("E-SMK03: notification URL is not allowed");
  if (args.lifecycleNotificationUrl !== policy.expectedLifecycleNotificationUrl)
    throw new Error("E-SMK03: lifecycle notification URL is not allowed");
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function validateEvidenceDestination(path: string, root: string): Promise<void> {
  const rootStat = await lstat(root).catch(() => {
    throw new Error("E-SMK03: evidence root is unavailable");
  });
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink())
    throw new Error("E-SMK03: evidence root must not be a symlink");
  if ((await realpath(root)) !== root || dirname(path) !== root)
    throw new Error("E-SMK03: evidence root/path must be canonical and direct");
  try {
    await lstat(path);
    throw new Error("E-SMK03: evidence target already exists");
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
}

export function parseGraphSmokeArgs(
  argv: string[],
  env: Record<string, string | undefined> = process.env,
): GraphSmokeArgs {
  const sandboxIndex = argv.indexOf("--sandbox");
  if (sandboxIndex < 0 || argv.lastIndexOf("--sandbox") !== sandboxIndex)
    throw new Error("E-SMK01: --sandbox is required once");
  if (env.AIOPS_GRAPH_SMOKE_ENABLED !== "true") throw new Error("E-SMK01: Graph smoke is disabled");
  const remaining = [...argv.slice(0, sandboxIndex), ...argv.slice(sandboxIndex + 1)];
  if (remaining.length !== ARGUMENTS.length * 2) throw new Error("E-SMK02: all smoke arguments are required");
  const values = new Map<string, string>();
  for (let index = 0; index < remaining.length; index += 2) {
    const key = remaining[index];
    const value = remaining[index + 1];
    if (!key?.startsWith("--") || value === undefined || value.startsWith("--"))
      throw new Error("E-SMK02: invalid argument");
    const name = key.slice(2);
    if (!ARGUMENTS.includes(name as (typeof ARGUMENTS)[number]) || values.has(name))
      throw new Error("E-SMK02: unknown or duplicate argument");
    values.set(name, value);
  }
  const args = {
    sandbox: true,
    teamId: values.get("teamId") ?? "",
    channelId: values.get("channelId") ?? "",
    senderMailbox: values.get("senderMailbox") ?? "",
    recipient: values.get("recipient") ?? "",
    notificationUrl: values.get("notificationUrl") ?? "",
    lifecycleNotificationUrl: values.get("lifecycleNotificationUrl") ?? "",
    evidencePath: values.get("evidencePath") ?? "",
  } satisfies GraphSmokeArgs;
  validateArgs(args);
  return args;
}

function validatedMetadata(
  value: GraphSmokeRequestMetadata,
  expectedStatuses: readonly number[],
  seenClientIds: Set<string>,
  seenRequestIds: Set<string>,
): GraphSmokeRequestMetadata {
  if (!UUID.test(value.clientRequestId) || seenClientIds.has(value.clientRequestId))
    throw new Error("E-SMK04: invalid client-request-id");
  if (!UUID.test(value.requestId) || seenRequestIds.has(value.requestId))
    throw new Error("E-SMK04: invalid Graph request-id");
  if (!HTTP_DATE.test(value.date) || new Date(value.date).toUTCString() !== value.date)
    throw new Error("E-SMK04: invalid Graph date");
  if (!expectedStatuses.includes(value.status)) throw new Error("E-SMK04: invalid Graph status");
  seenClientIds.add(value.clientRequestId);
  seenRequestIds.add(value.requestId);
  return { ...value };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function writeEvidenceAtomic(path: string, root: string, evidence: GraphSmokeEvidence): Promise<void> {
  const temporary = join(root, `.${basename(path)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await validateEvidenceDestination(path, root);
    await link(temporary, path);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}

export async function runGraphSmoke(
  args: GraphSmokeArgs,
  policy: GraphSmokeAccessPolicy,
  acquireOperations: (args: GraphSmokeArgs) => Promise<GraphSmokeOperations>,
  options: { now?: () => number } = {},
): Promise<GraphSmokeEvidence> {
  if (process.env.AIOPS_GRAPH_SMOKE_ENABLED !== "true") throw new Error("E-SMK01: Graph smoke is disabled");
  validateArgs(args, policy);
  await validateEvidenceDestination(args.evidencePath, policy.expectedEvidenceRoot);
  const now = options.now ?? Date.now;
  const startedAt = now();
  const requests: GraphSmokeRequestMetadata[] = [];
  const seenClientIds = new Set<string>();
  const seenRequestIds = new Set<string>();
  const refs: Record<string, string> = {
    team: sha256(args.teamId),
    channel: sha256(args.channelId),
    senderMailbox: sha256(args.senderMailbox),
    recipient: sha256(args.recipient),
    notificationUrl: sha256(args.notificationUrl),
    lifecycleNotificationUrl: sha256(args.lifecycleNotificationUrl),
  };
  let operations: GraphSmokeOperations | undefined;
  let subscriptionId: unknown;
  let createResolved = false;
  let cleanup: GraphSmokeEvidence["status"]["cleanup"] = "not_required";
  let dbEventCount = 0;
  let failure: unknown;
  const record = (metadata: GraphSmokeRequestMetadata, statuses: readonly number[]) =>
    requests.push(validatedMetadata(metadata, statuses, seenClientIds, seenRequestIds));

  try {
    operations = await acquireOperations(args);
    const created = await operations.createSubscription(args);
    createResolved = true;
    subscriptionId = created?.subscriptionId;
    if (!isCanonicalIdentifier(subscriptionId)) throw new Error("E-SMK05: invalid subscription ID");
    refs.subscription = sha256(subscriptionId);
    record(created.metadata, [201]);
    record(await operations.sendMail(args), [202]);
    const posted = await operations.postTeamsMessage(args);
    if (!isCanonicalIdentifier(posted.messageId)) throw new Error("E-SMK05: invalid message ID");
    refs.message = sha256(posted.messageId);
    record(posted.metadata, [201]);
    record(await operations.verifyCreatedNotification(args, posted.messageId), [200]);
    record(await operations.verifyLifecycleNotification(args, subscriptionId), [200]);
    dbEventCount = await operations.countCorrelatedDbEvents(args, {
      subscriptionId,
      messageId: posted.messageId,
      clientRequestIds: requests.map((request) => request.clientRequestId),
    });
    if (!Number.isSafeInteger(dbEventCount) || dbEventCount <= 0) throw new Error("E-SMK05: invalid DB event count");
  } catch (error) {
    failure = error;
  } finally {
    if (createResolved && operations) {
      cleanup = "failed";
      try {
        record(await operations.deleteSubscription(subscriptionId, args.teamId), [204, 404]);
        cleanup = "passed";
      } catch (error) {
        failure ??= error;
      }
    }
  }

  const evidence: GraphSmokeEvidence = {
    schemaVersion: "1.0",
    status: {
      sandbox: failure ? "failed" : "passed",
      cleanup,
      updatedDeletedReceipt: "pending_delegated_or_ui_tenant_phase",
    },
    durationMs: Math.max(0, Math.trunc(now() - startedAt)),
    graphRequests: requests,
    dbEventCount,
    resourceRefs: refs,
  };
  await writeEvidenceAtomic(args.evidencePath, policy.expectedEvidenceRoot, evidence);
  if (failure) throw new Error("E-SMK06: Graph smoke failed");
  return evidence;
}

async function main(): Promise<void> {
  parseGraphSmokeArgs(process.argv.slice(2));
  throw new Error(
    "E-SMK07: external tenant adapter is intentionally unavailable until External STOP gates are cleared",
  );
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("graphSmoke.js")) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "E-SMK07: Graph smoke failed"}\n`);
    process.exitCode = 1;
  });
}
