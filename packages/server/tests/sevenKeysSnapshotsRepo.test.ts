import { describe, expect, it, vi } from "vitest";
import { SevenKeysSnapshotsRepo, toExecutiveSevenKeys } from "../src/db/sevenKeysSnapshotsRepo.js";
import type { SevenKeysMonthlySnapshot } from "@aiops/prjops";

const snapshot: SevenKeysMonthlySnapshot = {
  month: "2026-07",
  projectId: "PRJ-0001",
  name: "案件A",
  improvedKeys: ["K1"],
  worsenedKeys: ["K3"],
  keys: [
    { keyId: "K1", title: "Stakeholders are committed", rag: "green", basis: "questionnaire" },
    { keyId: "K2", title: "Business benefits are realized", rag: "grey", basis: "missing" },
    { keyId: "K3", title: "Work and schedule are predictable", rag: "red", basis: "progress/isOverdue" },
    { keyId: "K4", title: "Scope is realistic and managed", rag: "green", basis: "scopeChangeCount" },
    { keyId: "K5", title: "Team is high performing", rag: "green", basis: "review wait/contributors" },
    { keyId: "K6", title: "Risks are mitigated", rag: "grey", basis: "risk questionnaire" },
    { keyId: "K7", title: "Delivery organization benefits are realized", rag: "grey", basis: "missing" },
  ],
};

describe("SevenKeysSnapshotsRepo (ADR-0010 / AC-038-1)", () => {
  it("AC-038-1: Seven Keys月次snapshotを追記し、同月重複はON CONFLICTで無視する", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    const repo = new SevenKeysSnapshotsRepo({ query });
    await expect(repo.insert(snapshot, "2026-07-01T00:00:00.000Z", ["K3を確認"])).resolves.toBe(true);
    expect(query.mock.calls[0]![0]).toContain("INSERT INTO seven_keys_snapshots");
    expect(query.mock.calls[0]![0]).toContain("ON CONFLICT (month, project_id) DO NOTHING");
    expect(JSON.parse(String(query.mock.calls[0]![1]![2]))).toMatchObject({ K1: "green", K3: "red" });
  });

  it("AC-038-1: 永続snapshotから前月比較用Seven Keysを復元する", async () => {
    const record = {
      month: "2026-06",
      project_id: "PRJ-0001",
      keys_rag: { K1: "green", K2: "grey", K3: "yellow", K4: "green", K5: "green", K6: "grey", K7: "grey" },
      improved_keys: [],
      worsened_keys: ["K3"],
      next_actions: ["K3を確認"],
      generated_at: "2026-06-01T00:00:00.000Z",
    };
    const repo = new SevenKeysSnapshotsRepo({ query: vi.fn().mockResolvedValue({ rows: [record] }) });
    const found = await repo.findLatestBefore("PRJ-0001", "2026-07");
    expect(found?.worsenedKeys).toEqual(["K3"]);
    expect(toExecutiveSevenKeys(found!).keys.find((key) => key.keyId === "K3")?.rag).toBe("yellow");
  });
});
