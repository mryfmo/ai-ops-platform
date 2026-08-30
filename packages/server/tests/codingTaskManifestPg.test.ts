/** 根拠: FinalArch:COD-001 / FinalArch:COD-003 / ADR-0006 / ADV-FIX-04 */
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CodingTasksRepo } from "../src/db/codingTasksRepo.js";
import { verifyCodingTaskManifestAuthority } from "../src/lib/codingTaskManifest.js";
import { applySchemaSerialized } from "./pgTestSchema.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const isolatedSchema = `advfix04_${randomUUID().replaceAll("-", "")}`;
const adminPool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 1 }) : undefined;
const pool = databaseUrl
  ? new Pool({ connectionString: databaseUrl, max: 2, options: `-c search_path=${isolatedSchema}` })
  : undefined;

describe.skipIf(!databaseUrl)("coding task manifest PostgreSQL authority (ADV-FIX-04)", () => {
  beforeAll(async () => {
    await adminPool!.query(`CREATE SCHEMA "${isolatedSchema}"`);
    await applySchemaSerialized(pool!, [new URL("../../devops/src/db/schema.sql", import.meta.url)]);
  });

  afterAll(async () => {
    await pool?.end();
    await adminPool?.query(`DROP SCHEMA IF EXISTS "${isolatedSchema}" CASCADE`);
    await adminPool?.end();
  });

  it("persists exact authority, permits lifecycle updates, and rejects manifest rewrites", async () => {
    const taskId = randomUUID();
    const repo = new CodingTasksRepo(pool!);
    const created = await repo.insert({
      taskId,
      projectId: "PJ-ADV-FIX-04",
      requestedBy: "USER:reviewer",
      source: "teams",
      instruction: "manifest authority",
      agent: "claude-code",
      traceId: randomUUID(),
      confirmTokenHash: "confirm-hash",
    });
    expect(() =>
      verifyCodingTaskManifestAuthority({
        taskId,
        agent: created.agent,
        manifest: created.manifest,
        manifestSha256: created.manifestSha256,
      }),
    ).not.toThrow();

    await expect(repo.claimForDispatch(taskId, { githubOwner: "acme", githubRepo: "widget" })).resolves.toBe(true);
    await expect(
      pool!.query("UPDATE coding_tasks SET manifest_sha256 = $2 WHERE task_id = $1", [taskId, "0".repeat(64)]),
    ).rejects.toThrow(/manifest authority is immutable/u);
    await expect(
      pool!.query("UPDATE coding_tasks SET manifest = $2 WHERE task_id = $1", [taskId, "{}\n"]),
    ).rejects.toThrow(/manifest authority is immutable/u);
  });
});
