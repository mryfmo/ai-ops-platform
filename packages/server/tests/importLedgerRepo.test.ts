import { describe, it, expect } from "vitest";
import type { PgQueryable } from "@aiops/shared";
import { ImportLedgerRepo } from "../src/db/importLedgerRepo.js";

interface Call {
  text: string;
  params: unknown[] | undefined;
}

function makeMockDb(rows: Array<Record<string, unknown>> = []) {
  const calls: Call[] = [];
  const db: PgQueryable = {
    query: async (text: string, params?: unknown[]) => {
      calls.push({ text, params });
      return { rows };
    },
  };
  return { db, calls };
}

describe("ImportLedgerRepo [REQ-037, PrjOps:SPEC-INT-063]", () => {
  it("source_keyで既存インポートを参照する", async () => {
    const { db, calls } = makeMockDb([
      {
        source_key: "ISS-1",
        target_kind: "issue",
        github_id: "I_1",
        import_run_id: "run-1",
        status: "imported",
      },
    ]);
    const repo = new ImportLedgerRepo(db);
    expect(await repo.findBySourceKey("ISS-1")).toEqual({
      sourceKey: "ISS-1",
      targetKind: "issue",
      githubId: "I_1",
      importRunId: "run-1",
      status: "imported",
    });
    expect(calls[0]!.text).toContain("FROM import_ledger WHERE source_key = $1");
  });

  it("insertはON CONFLICT DO NOTHINGで冪等に追記する", async () => {
    const { db, calls } = makeMockDb();
    const repo = new ImportLedgerRepo(db);
    await repo.insert({
      sourceKey: "MS-1",
      targetKind: "milestone",
      githubId: "M_1",
      importRunId: "run-1",
      status: "imported",
    });
    expect(calls[0]!.text).toContain("ON CONFLICT (source_key) DO NOTHING");
    expect(calls[0]!.params).toEqual(["MS-1", "milestone", "M_1", "run-1", "imported"]);
  });

  it("pending台帳行をimportedへ更新する", async () => {
    const { db, calls } = makeMockDb();
    const repo = new ImportLedgerRepo(db);
    await repo.markImported("ISS-1", "I_1");
    expect(calls[0]!.text).toContain("SET status = 'imported'");
    expect(calls[0]!.params).toEqual(["ISS-1", "I_1"]);
  });

  it("失敗理由を台帳に記録する", async () => {
    const { db, calls } = makeMockDb();
    const repo = new ImportLedgerRepo(db);
    await repo.markFailed("ISS-1", "github failed");
    expect(calls[0]!.text).toContain("SET status = 'failed'");
    expect(calls[0]!.params).toEqual(["ISS-1", "github failed"]);
  });
});
