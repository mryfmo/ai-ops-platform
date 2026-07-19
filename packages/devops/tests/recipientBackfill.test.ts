/**
 * packages/devops/tests/recipientBackfill.test.ts
 *
 * 根拠: P010-F02-T04 / DEC-SPEC-002 / DevOps:SPEC-INT-054。
 */
import { createHash, generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";
import { describe, expect, it } from "vitest";
import {
  MappingError,
  canonicalMappingPayload,
  parseSignedMapping,
  planRecipientBackfill,
  type MappingArtifact,
  type MappingTrust,
} from "../src/lib/recipientBackfill.js";
import {
  assertSandboxDatabase,
  executeRecipientBackfill,
  parseBackfillArgs,
  type BackfillPool,
} from "../src/tools/backfillRecipients.js";

const TENANT = "11111111-1111-4111-8111-111111111111";
const OBJECT_1 = "22222222-2222-4222-8222-222222222222";
const OBJECT_2 = "33333333-3333-4333-8333-333333333333";
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
const trust: MappingTrust = {
  configuredTenantId: TENANT,
  sourceRepositoryId: 123,
  sourceRepositoryNodeId: "R_example",
  sourceCommitSha: "1".repeat(40),
  signingKeyId: "owner-key",
  publicKeyPem: publicPem,
};

function signedArtifact(
  entries: MappingArtifact["entries"] = [
    {
      legacy_record_id: "ST-001",
      entra_tenant_id: TENANT,
      entra_object_id: OBJECT_1,
      disposition: "migrate_active",
      reason: "Owner-reviewed stable subject",
    },
  ],
): MappingArtifact {
  const payload = {
    contract_version: "1.0.0" as const,
    environment: {
      configured_tenant_id: TENANT,
      source_repository_id: 123,
      source_repository_node_id: "R_example",
      source_commit_sha: "1".repeat(40),
    },
    entries,
  };
  const bytes = canonicalMappingPayload(payload);
  return {
    ...payload,
    owner_approval: {
      owner_id: "data-owner",
      owner_role: "Data Owner",
      approved_at: "2026-07-19T00:00:00Z",
      payload_sha256: createHash("sha256").update(bytes).digest("hex"),
      signature_algorithm: "Ed25519",
      signing_key_id: "owner-key",
      signature_base64: sign(null, bytes, privateKey).toString("base64"),
    },
  };
}

function jsonBytes(artifact = signedArtifact()): Buffer {
  return Buffer.from(JSON.stringify(artifact));
}

function csvBytes(artifact = signedArtifact()): Buffer {
  const header = [
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
  ];
  const quote = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`;
  const rows = artifact.entries.map((entry) =>
    [
      artifact.contract_version,
      artifact.environment.configured_tenant_id,
      artifact.environment.source_repository_id,
      artifact.environment.source_repository_node_id,
      artifact.environment.source_commit_sha,
      artifact.owner_approval.owner_id,
      artifact.owner_approval.owner_role,
      artifact.owner_approval.approved_at,
      artifact.owner_approval.payload_sha256,
      artifact.owner_approval.signature_algorithm,
      artifact.owner_approval.signing_key_id,
      artifact.owner_approval.signature_base64,
      entry.legacy_record_id,
      entry.entra_tenant_id,
      entry.entra_object_id,
      entry.disposition,
      entry.reason,
    ]
      .map(quote)
      .join(","),
  );
  return Buffer.from([header.join(","), ...rows].join("\r\n"));
}

function expectCode(run: () => unknown, code: string): void {
  try {
    run();
    throw new Error("expected mapping failure");
  } catch (error) {
    expect(error).toBeInstanceOf(MappingError);
    expect((error as MappingError).code).toBe(code);
  }
}

function pendingRow(userId: string, objectId: string | null = null) {
  return {
    user_id: userId,
    active: false,
    entra_tenant_id: objectId ? TENANT : null,
    entra_object_id: objectId,
    backfill_disposition: objectId ? "deactivate" : null,
    backfill_state: objectId ? "applied" : "pending",
  };
}

describe("legacy recipient mapping parser [P010-F02-T04 / DEC-SPEC-002 / DevOps:SPEC-INT-054]", () => {
  it("signed JSONとRFC4180 CSVを同じmappingへ正規化しraw digestを固定する", () => {
    const artifact = signedArtifact([
      {
        legacy_record_id: "ST-001",
        entra_tenant_id: TENANT,
        entra_object_id: OBJECT_1,
        disposition: "migrate_active",
        reason: "Owner review, including comma",
      },
    ]);
    const json = parseSignedMapping(jsonBytes(artifact), "json", trust);
    const csv = parseSignedMapping(csvBytes(artifact), "csv", trust);

    expect(csv.artifact).toEqual(json.artifact);
    expect(json.dryRunDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(csv.dryRunDigest).not.toBe(json.dryRunDigest);
  });

  it("ES256 DER signatureもtrusted keyで検証する", () => {
    const keys = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const artifact = signedArtifact();
    const bytes = canonicalMappingPayload(artifact);
    artifact.owner_approval.signature_algorithm = "ES256";
    artifact.owner_approval.signing_key_id = "owner-es256";
    artifact.owner_approval.signature_base64 = sign("sha256", bytes, keys.privateKey).toString("base64");
    expect(
      parseSignedMapping(jsonBytes(artifact), "json", {
        ...trust,
        signingKeyId: "owner-es256",
        publicKeyPem: keys.publicKey.export({ type: "spki", format: "pem" }).toString(),
      }).artifact,
    ).toEqual(artifact);

    const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
    artifact.owner_approval.signing_key_id = "owner-rsa";
    artifact.owner_approval.signature_base64 = sign("sha256", bytes, rsa.privateKey).toString("base64");
    expectCode(
      () =>
        parseSignedMapping(jsonBytes(artifact), "json", {
          ...trust,
          signingKeyId: "owner-rsa",
          publicKeyPem: rsa.publicKey.export({ type: "spki", format: "pem" }).toString(),
        }),
      "E-MAPPING-SIGNATURE",
    );
  });

  it("failure table順にschema/signature/env/duplicate/foreign tenantを拒否する", () => {
    expectCode(() => parseSignedMapping(Buffer.from("{}"), "json", trust), "E-MAPPING-SCHEMA");

    const invalidSignature = signedArtifact();
    invalidSignature.owner_approval.signature_base64 = Buffer.from("invalid").toString("base64");
    expectCode(() => parseSignedMapping(jsonBytes(invalidSignature), "json", trust), "E-MAPPING-SIGNATURE");

    expectCode(
      () => parseSignedMapping(jsonBytes(), "json", { ...trust, sourceCommitSha: "2".repeat(40) }),
      "E-MAPPING-ENV",
    );
    expectCode(
      () =>
        parseSignedMapping(
          jsonBytes(
            signedArtifact([
              signedArtifact().entries[0]!,
              { ...signedArtifact().entries[0]!, entra_object_id: OBJECT_2 },
            ]),
          ),
          "json",
          trust,
        ),
      "E-MAPPING-DUPLICATE-LEGACY",
    );
    expectCode(
      () =>
        parseSignedMapping(
          jsonBytes(
            signedArtifact([
              signedArtifact().entries[0]!,
              { ...signedArtifact().entries[0]!, legacy_record_id: "ST-002" },
            ]),
          ),
          "json",
          trust,
        ),
      "E-MAPPING-DUPLICATE-SUBJECT",
    );
    expectCode(
      () =>
        parseSignedMapping(
          jsonBytes(
            signedArtifact([
              {
                ...signedArtifact().entries[0]!,
                entra_tenant_id: "99999999-9999-4999-8999-999999999999",
              },
            ]),
          ),
          "json",
          trust,
        ),
      "E-MAPPING-FOREIGN-TENANT",
    );
  });

  it("unresolved/inactiveを拒否しexact applied行はidempotent no-opにする", () => {
    const mapping = parseSignedMapping(jsonBytes(), "json", trust).artifact;
    expectCode(() => planRecipientBackfill(mapping, []), "E-MAPPING-UNRESOLVED");
    expectCode(() => planRecipientBackfill(mapping, [pendingRow("ST-001", OBJECT_1)]), "E-MAPPING-INACTIVE");

    const exact = {
      ...pendingRow("ST-001", OBJECT_1),
      active: true,
      backfill_disposition: "migrate_active",
    };
    expect(planRecipientBackfill(mapping, [exact])).toMatchObject({
      updates: [],
      summary: { entries: 1, migrate_active: 1, already_applied: 1 },
    });
  });
});

function fakePool(
  rows: ReturnType<typeof pendingRow>[],
  failUpdate = false,
): {
  pool: BackfillPool;
  calls: string[];
} {
  const calls: string[] = [];
  const client = {
    query: async (text: string) => {
      calls.push(text);
      if (text.includes("SELECT user_id, active")) return { rows };
      if (text.startsWith("UPDATE recipients")) {
        if (failUpdate) throw new Error("forced update failure");
        return { rows: [{ user_id: "ST-001" }], rowCount: 1 };
      }
      if (text.includes("AS active_email_only")) return { rows: [{ active_email_only: "0" }] };
      return { rows: [] };
    },
    release: () => undefined,
  };
  return { pool: { connect: async () => client }, calls };
}

describe("legacy recipient backfill transaction [P010-F02-T04 / DEC-SPEC-002 / DevOps:SPEC-INT-054]", () => {
  const parsed = parseSignedMapping(jsonBytes(), "json", trust);

  it("CLIはapply confirmationを必須にしunknown/duplicate引数を拒否する", () => {
    const common = [
      "--mapping",
      "mapping.json",
      "--public-key",
      "owner.pem",
      "--signing-key-id",
      "owner-key",
      "--tenant-id",
      TENANT,
      "--repository-id",
      "123",
      "--repository-node-id",
      "R_example",
      "--commit-sha",
      "1".repeat(40),
    ];
    expect(parseBackfillArgs(["dry-run", ...common])).toMatchObject({ operation: "dry-run", repositoryId: 123 });
    expect(() => parseBackfillArgs(["apply", ...common])).toThrow(/dry-run-digest.*confirm-sandbox-database/);
    expect(() => parseBackfillArgs(["dry-run", ...common, "--mapping", "again.json"])).toThrow(/duplicate/);
  });

  it("dry-runはSELECTだけでsummary/digestを返す", async () => {
    const { pool, calls } = fakePool([pendingRow("ST-001")]);
    const result = await executeRecipientBackfill(pool, parsed.artifact, {
      operation: "dry-run",
      dryRunDigest: parsed.dryRunDigest,
    });
    expect(result).toMatchObject({ operation: "dry-run", digest: parsed.dryRunDigest, entries: 1 });
    expect(calls.some((call) => call.startsWith("UPDATE recipients"))).toBe(false);
  });

  it("applyはexact digestとsandbox確認を要求しtransactionで一括更新する", async () => {
    expectCode(() => assertSandboxDatabase("postgres://localhost:55432/aiops_a015", "wrong"), "E-MAPPING-ENV");
    expectCode(
      () => assertSandboxDatabase("postgres://localhost:55432/aiops_a015?host=production", "aiops_a015"),
      "E-MAPPING-ENV",
    );
    expect(assertSandboxDatabase("postgres://localhost:55432/aiops_a015", "aiops_a015")).toBe("aiops_a015");

    const unconfirmed = fakePool([pendingRow("ST-001")]);
    await expect(
      executeRecipientBackfill(unconfirmed.pool, parsed.artifact, {
        operation: "apply",
        dryRunDigest: parsed.dryRunDigest,
        expectedDigest: parsed.dryRunDigest,
      }),
    ).rejects.toMatchObject({ code: "E-MAPPING-ENV" });
    expect(unconfirmed.calls).toEqual([]);

    const mismatch = fakePool([pendingRow("ST-001")]);
    await expect(
      executeRecipientBackfill(mismatch.pool, parsed.artifact, {
        operation: "apply",
        dryRunDigest: parsed.dryRunDigest,
        expectedDigest: "f".repeat(64),
        sandboxConfirmed: true,
      }),
    ).rejects.toMatchObject({ code: "E-MAPPING-DIGEST" });
    expect(mismatch.calls.some((call) => call.startsWith("UPDATE recipients"))).toBe(false);

    const applied = fakePool([pendingRow("ST-001")]);
    await expect(
      executeRecipientBackfill(applied.pool, parsed.artifact, {
        operation: "apply",
        dryRunDigest: parsed.dryRunDigest,
        expectedDigest: parsed.dryRunDigest,
        sandboxConfirmed: true,
      }),
    ).resolves.toMatchObject({ operation: "apply", applied: 1 });
    expect(applied.calls).toContain("COMMIT");
  });

  it("update失敗時は全transactionをrollbackする", async () => {
    const { pool, calls } = fakePool([pendingRow("ST-001")], true);
    await expect(
      executeRecipientBackfill(pool, parsed.artifact, {
        operation: "apply",
        dryRunDigest: parsed.dryRunDigest,
        expectedDigest: parsed.dryRunDigest,
        sandboxConfirmed: true,
      }),
    ).rejects.toThrow("forced update failure");
    expect(calls.at(-1)).toBe("ROLLBACK");
  });
});

const testDatabaseName = process.env["AIOPS_TEST_DATABASE_NAME"];
const postgresDescribe = testDatabaseName ? describe : describe.skip;
const schema = readFileSync(new URL("../src/db/schema.sql", import.meta.url), "utf8");

postgresDescribe("legacy recipient backfill PostgreSQL [P010-F02-T04 / DEC-SPEC-002 / DevOps:SPEC-INT-054]", () => {
  it("dry-run無書込み、rollback、apply、idempotent reapplyを実測する", async () => {
    if (!testDatabaseName) throw new Error("AIOPS_TEST_DATABASE_NAME is required");
    const namespace = `t04_${randomUUID().replaceAll("-", "")}`;
    const base = `postgres://127.0.0.1:${process.env["AIOPS_TEST_DATABASE_PORT"] ?? "55432"}/${testDatabaseName}`;
    const setup = new pg.Client({ connectionString: base });
    await setup.connect();
    try {
      await setup.query(`CREATE SCHEMA "${namespace}"`);
      await setup.query(`SET search_path TO "${namespace}"`);
      await setup.query(schema);
      await setup.query(
        `INSERT INTO recipients (
           user_id, profile, email, active, scope_mode, backfill_state
         ) VALUES
           ('ST-001', 'PRF-02', 'one@example.com', false, 'project', 'pending'),
           ('ST-002', 'PRF-02', 'two@example.com', false, 'project', 'pending')`,
      );
      const pool = new pg.Pool({
        connectionString: `${base}?options=-csearch_path%3D${namespace}`,
      });
      const artifact = signedArtifact([
        signedArtifact().entries[0]!,
        {
          legacy_record_id: "ST-002",
          entra_tenant_id: TENANT,
          entra_object_id: OBJECT_2,
          disposition: "deactivate",
          reason: "Owner-reviewed deactivation",
        },
      ]);
      const parsed = parseSignedMapping(jsonBytes(artifact), "json", trust);
      try {
        const before = await setup.query("SELECT * FROM recipients ORDER BY user_id");
        await executeRecipientBackfill(pool, parsed.artifact, {
          operation: "dry-run",
          dryRunDigest: parsed.dryRunDigest,
        });
        expect((await setup.query("SELECT * FROM recipients ORDER BY user_id")).rows).toEqual(before.rows);

        await setup.query(`
          CREATE FUNCTION fail_st002() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN
            IF NEW.user_id = 'ST-002' THEN RAISE EXCEPTION 'forced rollback'; END IF;
            RETURN NEW;
          END $$;
          CREATE TRIGGER fail_st002 BEFORE UPDATE ON recipients
          FOR EACH ROW EXECUTE FUNCTION fail_st002()
        `);
        await expect(
          executeRecipientBackfill(pool, parsed.artifact, {
            operation: "apply",
            dryRunDigest: parsed.dryRunDigest,
            expectedDigest: parsed.dryRunDigest,
            sandboxConfirmed: true,
          }),
        ).rejects.toThrow("forced rollback");
        expect((await setup.query("SELECT * FROM recipients ORDER BY user_id")).rows).toEqual(before.rows);
        await setup.query("DROP TRIGGER fail_st002 ON recipients");

        await expect(
          executeRecipientBackfill(pool, parsed.artifact, {
            operation: "apply",
            dryRunDigest: parsed.dryRunDigest,
            expectedDigest: parsed.dryRunDigest,
            sandboxConfirmed: true,
          }),
        ).resolves.toMatchObject({ applied: 2 });
        await expect(
          executeRecipientBackfill(pool, parsed.artifact, {
            operation: "apply",
            dryRunDigest: parsed.dryRunDigest,
            expectedDigest: parsed.dryRunDigest,
            sandboxConfirmed: true,
          }),
        ).resolves.toMatchObject({ applied: 0, already_applied: 2 });
        expect(
          (
            await setup.query(
              "SELECT user_id, active, backfill_state, backfill_disposition FROM recipients ORDER BY user_id",
            )
          ).rows,
        ).toEqual([
          {
            user_id: "ST-001",
            active: true,
            backfill_state: "applied",
            backfill_disposition: "migrate_active",
          },
          {
            user_id: "ST-002",
            active: false,
            backfill_state: "applied",
            backfill_disposition: "deactivate",
          },
        ]);
      } finally {
        await pool.end();
      }
    } finally {
      await setup.query("SET search_path TO public");
      await setup.query(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`);
      await setup.end();
    }
  });
});
