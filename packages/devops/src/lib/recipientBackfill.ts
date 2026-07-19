/**
 * packages/devops/src/lib/recipientBackfill.ts
 *
 * 根拠: P010-F02-T04 / DEC-SPEC-002 / DevOps:SPEC-INT-054。
 * Signed legacy mappingのparse、検証、適用計画は外部I/Oを持たないpure functionに限定する。
 */
import { createHash, createPublicKey, verify } from "node:crypto";
import { z } from "zod";

export type MappingErrorCode =
  | "E-MAPPING-SCHEMA"
  | "E-MAPPING-SIGNATURE"
  | "E-MAPPING-ENV"
  | "E-MAPPING-DUPLICATE-LEGACY"
  | "E-MAPPING-DUPLICATE-SUBJECT"
  | "E-MAPPING-FOREIGN-TENANT"
  | "E-MAPPING-UNRESOLVED"
  | "E-MAPPING-INACTIVE"
  | "E-MAPPING-DIGEST";

export class MappingError extends Error {
  constructor(
    readonly code: MappingErrorCode,
    message: string,
  ) {
    super(`${code}: ${message}`);
    this.name = "MappingError";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const nonblank = z.string().refine((value) => value.trim().length > 0);
const environmentSchema = z
  .object({
    configured_tenant_id: z.string().regex(UUID),
    source_repository_id: z.number().int().positive(),
    source_repository_node_id: nonblank,
    source_commit_sha: z.string().regex(SHA40),
  })
  .strict();
const approvalSchema = z
  .object({
    owner_id: nonblank,
    owner_role: z.literal("Data Owner"),
    approved_at: z.string().datetime({ offset: true }),
    payload_sha256: z.string().regex(SHA256),
    signature_algorithm: z.enum(["ES256", "Ed25519"]),
    signing_key_id: nonblank,
    signature_base64: z.string().min(4).regex(BASE64),
  })
  .strict();
const entrySchema = z
  .object({
    legacy_record_id: z.string().regex(/^ST-[0-9]+$/),
    entra_tenant_id: z.string().regex(UUID),
    entra_object_id: z.string().regex(UUID),
    disposition: z.enum(["migrate_active", "deactivate", "erase_after_retention"]),
    reason: nonblank,
  })
  .strict();
const artifactSchema = z
  .object({
    contract_version: z.literal("1.0.0"),
    environment: environmentSchema,
    owner_approval: approvalSchema,
    entries: z.array(entrySchema).min(1),
  })
  .strict();

export type MappingArtifact = z.infer<typeof artifactSchema>;
export type MappingPayload = Pick<MappingArtifact, "contract_version" | "environment" | "entries">;

export interface MappingTrust {
  configuredTenantId: string;
  sourceRepositoryId: number;
  sourceRepositoryNodeId: string;
  sourceCommitSha: string;
  signingKeyId: string;
  publicKeyPem: string;
}

export interface ParsedMapping {
  artifact: MappingArtifact;
  dryRunDigest: string;
}

export interface RecipientBackfillRow {
  user_id: string;
  active: boolean;
  entra_tenant_id: string | null;
  entra_object_id: string | null;
  backfill_disposition: string | null;
  backfill_state: string;
}

export interface BackfillSummary {
  entries: number;
  migrate_active: number;
  deactivate: number;
  erase_after_retention: number;
  already_applied: number;
}

export interface BackfillPlan {
  updates: MappingArtifact["entries"];
  summary: BackfillSummary;
}

const CSV_COLUMNS = [
  "contract_version",
  "configured_tenant_id",
  "source_repository_id",
  "source_repository_node_id",
  "source_commit_sha",
  "owner_id",
  "owner_role",
  "approved_at",
  "payload_sha256",
  "signature_algorithm",
  "signing_key_id",
  "signature_base64",
  "legacy_record_id",
  "entra_tenant_id",
  "entra_object_id",
  "disposition",
  "reason",
] as const;

function fail(code: MappingErrorCode, message: string): never {
  throw new MappingError(code, message);
}

function decode(raw: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(raw).replace(/^\uFEFF/, "");
  } catch {
    return fail("E-MAPPING-SCHEMA", "mapping must be UTF-8");
  }
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        closedQuote = true;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell === "") {
      quoted = true;
    } else if (closedQuote && character !== "," && character !== "\n" && character !== "\r") {
      return fail("E-MAPPING-SCHEMA", "invalid character after CSV quote");
    } else if (character === ",") {
      row.push(cell);
      cell = "";
      closedQuote = false;
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      closedQuote = false;
    } else if (character === '"') {
      return fail("E-MAPPING-SCHEMA", "invalid CSV quote");
    } else {
      cell += character;
    }
  }
  if (quoted) return fail("E-MAPPING-SCHEMA", "unterminated CSV quote");
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function parseCsvArtifact(raw: Uint8Array): unknown {
  const rows = parseCsvRows(decode(raw));
  const header = rows.shift();
  if (!header || header.length !== CSV_COLUMNS.length || header.some((value, index) => value !== CSV_COLUMNS[index])) {
    return fail("E-MAPPING-SCHEMA", "CSV header must match the contract");
  }
  if (rows.length === 0 || rows.some((row) => row.length !== CSV_COLUMNS.length)) {
    return fail("E-MAPPING-SCHEMA", "CSV must contain complete entry rows");
  }
  const records = rows.map((row) => Object.fromEntries(CSV_COLUMNS.map((column, index) => [column, row[index]])));
  const first = records[0]!;
  const metadata = CSV_COLUMNS.slice(0, 12);
  if (records.some((record) => metadata.some((column) => record[column] !== first[column]))) {
    return fail("E-MAPPING-SCHEMA", "CSV contract metadata must be identical on every row");
  }
  return {
    contract_version: first.contract_version,
    environment: {
      configured_tenant_id: first.configured_tenant_id,
      source_repository_id: Number(first.source_repository_id),
      source_repository_node_id: first.source_repository_node_id,
      source_commit_sha: first.source_commit_sha,
    },
    owner_approval: {
      owner_id: first.owner_id,
      owner_role: first.owner_role,
      approved_at: first.approved_at,
      payload_sha256: first.payload_sha256,
      signature_algorithm: first.signature_algorithm,
      signing_key_id: first.signing_key_id,
      signature_base64: first.signature_base64,
    },
    entries: records.map((record) => ({
      legacy_record_id: record.legacy_record_id,
      entra_tenant_id: record.entra_tenant_id,
      entra_object_id: record.entra_object_id,
      disposition: record.disposition,
      reason: record.reason,
    })),
  };
}

function parseArtifact(raw: Uint8Array, format: "json" | "csv"): MappingArtifact {
  let input: unknown;
  try {
    input = format === "json" ? JSON.parse(decode(raw)) : parseCsvArtifact(raw);
  } catch (error) {
    if (error instanceof MappingError) throw error;
    return fail("E-MAPPING-SCHEMA", "mapping is not valid JSON");
  }
  const parsed = artifactSchema.safeParse(input);
  if (!parsed.success) return fail("E-MAPPING-SCHEMA", parsed.error.issues[0]?.message ?? "invalid mapping");
  return parsed.data;
}

export function canonicalMappingPayload(payload: MappingPayload): Buffer {
  return Buffer.from(
    JSON.stringify({
      contract_version: payload.contract_version,
      environment: {
        configured_tenant_id: payload.environment.configured_tenant_id,
        source_repository_id: payload.environment.source_repository_id,
        source_repository_node_id: payload.environment.source_repository_node_id,
        source_commit_sha: payload.environment.source_commit_sha,
      },
      entries: payload.entries.map((entry) => ({
        legacy_record_id: entry.legacy_record_id,
        entra_tenant_id: entry.entra_tenant_id,
        entra_object_id: entry.entra_object_id,
        disposition: entry.disposition,
        reason: entry.reason,
      })),
    }),
  );
}

function validateSignature(artifact: MappingArtifact, trust: MappingTrust): void {
  const payload = canonicalMappingPayload(artifact);
  const digest = createHash("sha256").update(payload).digest("hex");
  if (
    artifact.owner_approval.signing_key_id !== trust.signingKeyId ||
    artifact.owner_approval.payload_sha256 !== digest
  ) {
    return fail("E-MAPPING-SIGNATURE", "approval key or payload digest does not match");
  }
  try {
    const signature = Buffer.from(artifact.owner_approval.signature_base64, "base64");
    const key = createPublicKey(trust.publicKeyPem);
    if (
      (artifact.owner_approval.signature_algorithm === "Ed25519" && key.asymmetricKeyType !== "ed25519") ||
      (artifact.owner_approval.signature_algorithm === "ES256" &&
        (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1"))
    ) {
      return fail("E-MAPPING-SIGNATURE", "public key type does not match the declared algorithm");
    }
    const algorithm = artifact.owner_approval.signature_algorithm === "Ed25519" ? null : "sha256";
    if (!verify(algorithm, payload, key, signature)) {
      return fail("E-MAPPING-SIGNATURE", "signature verification failed");
    }
  } catch (error) {
    if (error instanceof MappingError) throw error;
    return fail("E-MAPPING-SIGNATURE", "signature verification failed");
  }
}

function validateEnvironment(artifact: MappingArtifact, trust: MappingTrust): void {
  const environment = artifact.environment;
  if (
    environment.configured_tenant_id !== trust.configuredTenantId ||
    environment.source_repository_id !== trust.sourceRepositoryId ||
    environment.source_repository_node_id !== trust.sourceRepositoryNodeId ||
    environment.source_commit_sha !== trust.sourceCommitSha
  ) {
    return fail("E-MAPPING-ENV", "mapping environment differs from protected evidence");
  }
}

export function parseSignedMapping(raw: Uint8Array, format: "json" | "csv", trust: MappingTrust): ParsedMapping {
  const artifact = parseArtifact(raw, format);
  validateSignature(artifact, trust);
  validateEnvironment(artifact, trust);

  const legacyIds = new Set<string>();
  for (const entry of artifact.entries) {
    if (legacyIds.has(entry.legacy_record_id)) {
      return fail("E-MAPPING-DUPLICATE-LEGACY", `duplicate legacy ID ${entry.legacy_record_id}`);
    }
    legacyIds.add(entry.legacy_record_id);
  }
  const subjects = new Set<string>();
  for (const entry of artifact.entries) {
    const subject = `${entry.entra_tenant_id}/${entry.entra_object_id}`;
    if (subjects.has(subject)) return fail("E-MAPPING-DUPLICATE-SUBJECT", `duplicate stable subject ${subject}`);
    subjects.add(subject);
  }
  for (const entry of artifact.entries) {
    if (entry.entra_tenant_id !== trust.configuredTenantId) {
      return fail("E-MAPPING-FOREIGN-TENANT", `foreign tenant for ${entry.legacy_record_id}`);
    }
  }
  return { artifact, dryRunDigest: createHash("sha256").update(raw).digest("hex") };
}

export function planRecipientBackfill(artifact: MappingArtifact, rows: RecipientBackfillRow[]): BackfillPlan {
  const updates: MappingArtifact["entries"] = [];
  let alreadyApplied = 0;
  for (const entry of artifact.entries) {
    const matches = rows.filter((row) => row.user_id === entry.legacy_record_id);
    if (matches.length !== 1) return fail("E-MAPPING-UNRESOLVED", `no unique recipient ${entry.legacy_record_id}`);
    const row = matches[0]!;
    const conflict = rows.find(
      (candidate) =>
        candidate.user_id !== entry.legacy_record_id &&
        candidate.entra_tenant_id === entry.entra_tenant_id &&
        candidate.entra_object_id === entry.entra_object_id,
    );
    if (conflict) return fail("E-MAPPING-DUPLICATE-SUBJECT", `stable subject belongs to ${conflict.user_id}`);

    const expectedActive = entry.disposition === "migrate_active";
    if (row.backfill_state === "applied") {
      if (entry.disposition === "migrate_active" && !row.active) {
        return fail("E-MAPPING-INACTIVE", `recipient ${entry.legacy_record_id} is inactive`);
      }
      if (
        row.entra_tenant_id !== entry.entra_tenant_id ||
        row.entra_object_id !== entry.entra_object_id ||
        row.backfill_disposition !== entry.disposition ||
        row.active !== expectedActive
      ) {
        return fail("E-MAPPING-UNRESOLVED", `recipient ${entry.legacy_record_id} was applied differently`);
      }
      alreadyApplied += 1;
      continue;
    }
    if (
      row.backfill_state !== "pending" ||
      row.active ||
      row.entra_tenant_id !== null ||
      row.entra_object_id !== null ||
      row.backfill_disposition !== null
    ) {
      return fail("E-MAPPING-UNRESOLVED", `recipient ${entry.legacy_record_id} is not pending`);
    }
    updates.push(entry);
  }

  return {
    updates,
    summary: {
      entries: artifact.entries.length,
      migrate_active: artifact.entries.filter((entry) => entry.disposition === "migrate_active").length,
      deactivate: artifact.entries.filter((entry) => entry.disposition === "deactivate").length,
      erase_after_retention: artifact.entries.filter((entry) => entry.disposition === "erase_after_retention").length,
      already_applied: alreadyApplied,
    },
  };
}
