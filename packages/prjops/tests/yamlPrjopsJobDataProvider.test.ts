/** 根拠: PrjOps:REQ-001/002/007/009 / PrjOps:SPEC-INT-020/025/032 */
import { describe, expect, it, vi } from "vitest";
import { buildPrjopsDataManifest, type SnapshotEntry } from "../src/lib/prjopsDataSnapshotValidator.js";
import { YamlPrjopsJobDataProvider, type PrjopsJobSnapshotSource } from "../src/data/yamlPrjopsJobDataProvider.js";

const COMMIT = "1".repeat(40);
const lifecycle = {
  active: true,
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
  updated_by: "ST-001",
  deactivated_at: null,
  deactivation_reason: null,
};
const entry = (path: string, document: unknown): SnapshotEntry => ({
  path,
  kind: "regular",
  bytes: Buffer.from(`${JSON.stringify(document)}\n`),
});

function snapshot(): { entries: SnapshotEntry[]; checksum: string } {
  const documents: Record<string, unknown> = {
    "organizations/ORG-001.yaml": {
      id: "ORG-001",
      name: "Org",
      country: "JP",
      domestic_or_overseas: "domestic",
      ...lifecycle,
    },
    "projects/PJ-001.yaml": {
      id: "PJ-001",
      name: "Active",
      leader_id: "ST-001",
      manager_id: "ST-002",
      organization_ids: ["ORG-001"],
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      report_frequency: "weekly",
      status: "active",
      ...lifecycle,
    },
    "stakeholders/ST-001.yaml": {
      id: "ST-001",
      name: "Owner",
      organization_id: "ORG-001",
      entra_tenant_id: "11111111-1111-1111-1111-111111111111",
      entra_object_id: "22222222-2222-2222-2222-222222222222",
      assignments: [{ domain: "prjops", profile: "PRF-02", scope_mode: "project", project_id: "PJ-001", active: true }],
      invested_project_ids: [],
      email: "owner@example.com",
      teams_user_id: "teams-owner",
      preferred_language: "ja",
      timezone: "Asia/Tokyo",
      ...lifecycle,
    },
    "stakeholders/ST-002.yaml": {
      id: "ST-002",
      name: "Manager",
      organization_id: "ORG-001",
      entra_tenant_id: "33333333-3333-3333-3333-333333333333",
      entra_object_id: "44444444-4444-4444-4444-444444444444",
      assignments: [{ domain: "prjops", profile: "PRF-03", scope_mode: "project", project_id: "PJ-001", active: true }],
      invested_project_ids: [],
      email: "manager@example.com",
      teams_user_id: "teams-manager",
      preferred_language: "ja",
      timezone: "Asia/Tokyo",
      ...lifecycle,
    },
    "issues/ISSUE-001.yaml": {
      id: "ISSUE-001",
      project_id: "PJ-001",
      title: "Critical",
      detail: "impact",
      severity: "high",
      severity_proposed: null,
      status: "open",
      closed_by: null,
      closed_reason: null,
      ...lifecycle,
    },
    "actions/ACT-001.yaml": {
      id: "ACT-001",
      project_id: "PJ-001",
      title: "Action",
      assignee: "ST-001",
      due: "2026-07-10",
      status: "open",
      reminders_sent: ["2026-07-10T00:00:00Z"],
      ...lifecycle,
    },
    "status_updates/SU-001.yaml": {
      id: "SU-001",
      project_id: "PJ-001",
      period: { start: "2026-07-01", end: "2026-07-07" },
      channel: "web",
      reporter: "ST-001",
      progress_pct: 40,
      self_status: "yellow",
      achievements: "done",
      plans: "next",
      issues: [],
      risks: [],
      complete: true,
      raw_source: "audit/source",
      ...lifecycle,
    },
    "investor/financial_inputs.yaml": {
      currency: "JPY",
      as_of: "2026-06-30",
      projects: [{ project_id: "PJ-001", ownership_pct: 100, revenue: 1, ebitda: 1 }],
      updated_at: lifecycle.updated_at,
      updated_by: "ST-001",
    },
    "investor/board_pack.yaml": {
      targets: { revenue: 1, ebitda: 1 },
      history: [],
      updated_at: lifecycle.updated_at,
      updated_by: "ST-001",
    },
  };
  const data = Object.entries(documents).map(([path, document]) => entry(path, document));
  const manifest = buildPrjopsDataManifest(data);
  if (!manifest.ok) throw new Error(manifest.code);
  return {
    checksum: manifest.contentSha256,
    entries: [
      entry("schema/version.yaml", {
        schema_version: "1.0.0",
        generated_at: lifecycle.updated_at,
        content_sha256: manifest.contentSha256,
      }),
      ...data,
    ],
  };
}

describe("YamlPrjopsJobDataProvider [PrjOps:REQ-001/002/007/009]", () => {
  it("pinned snapshotからactive analysis入力とopen action宛先を決定的に導出する", async () => {
    const fixture = snapshot();
    const source: PrjopsJobSnapshotSource = {
      load: vi.fn(async () => ({ commitSha: COMMIT, entries: fixture.entries })),
    };
    const provider = new YamlPrjopsJobDataProvider(
      source,
      COMMIT,
      fixture.checksum,
      () => new Date("2026-07-20T00:00:00Z"),
    );

    await expect(provider.listActiveProjects()).resolves.toEqual([
      expect.objectContaining({
        projectId: "PJ-001",
        selfStatus: "yellow",
        progressPct: 40,
        highSeverityOpenIssueCount: 1,
        overdueActionCount: 1,
      }),
    ]);
    await expect(provider.listOpenActions()).resolves.toEqual([
      expect.objectContaining({
        id: "ACT-001",
        assigneeEmail: "owner@example.com",
        managerEmail: "manager@example.com",
        remindersSentCountBaseline: 1,
      }),
    ]);
  });

  it("commitまたはchecksum不一致を空データへ倒さず拒否する", async () => {
    const fixture = snapshot();
    const source: PrjopsJobSnapshotSource = {
      load: async () => ({ commitSha: "2".repeat(40), entries: fixture.entries }),
    };
    const provider = new YamlPrjopsJobDataProvider(source, COMMIT, fixture.checksum);
    await expect(provider.listActiveProjects()).rejects.toThrow(/commit/i);
  });
});
