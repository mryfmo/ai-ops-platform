/**
 * 根拠: P010-F02-T07 / DEC-SPEC-001 / PrjOps:REQ-041
 */
import { buildPrjopsDataManifest, type SnapshotEntry } from "@aiops/prjops";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import { loadWebConfig } from "../../src/server/config";
import {
  PinnedPrjopsReportDataProvider,
  FileSystemPrjopsSnapshotSource,
  PrjopsDataAccessDeniedError,
  PrjopsDataUnavailableError,
  createPinnedPrjopsReportDataProvider,
  type PrjopsSnapshotSource,
} from "../../src/server/reportData/pinnedPrjopsReportDataProvider";
import { buildManagerSummary } from "../../src/server/reportData/prjopsReportData";
import { toErrorResponse } from "../../src/server/reportData/dataApiSupport";

const COMMIT = "1".repeat(40);
const SUBJECT = {
  tenantId: "11111111-1111-1111-1111-111111111111",
  objectId: "22222222-2222-2222-2222-222222222222",
};
const lifecycle = {
  active: true,
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
  updated_by: "ST-001",
  deactivated_at: null,
  deactivation_reason: null,
};

function entry(path: string, document: unknown): SnapshotEntry {
  return { path, kind: "regular", bytes: Buffer.from(`${JSON.stringify(document)}\n`) };
}

function snapshot(): { entries: SnapshotEntry[]; checksum: string } {
  const documents: Record<string, unknown> = {
    "organizations/ORG-001.yaml": {
      id: "ORG-001",
      name: "Organization",
      country: "JP",
      domestic_or_overseas: "domestic",
      ...lifecycle,
    },
    "projects/PJ-001.yaml": {
      id: "PJ-001",
      name: "Allowed",
      leader_id: "ST-001",
      manager_id: "ST-001",
      organization_ids: ["ORG-001"],
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      report_frequency: "weekly",
      status: "active",
      ...lifecycle,
    },
    "projects/PJ-002.yaml": {
      id: "PJ-002",
      name: "Denied",
      leader_id: "ST-002",
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
      name: "Allowed User",
      organization_id: "ORG-001",
      entra_tenant_id: SUBJECT.tenantId,
      entra_object_id: SUBJECT.objectId,
      assignments: [
        {
          domain: "prjops",
          profile: "PRF-02",
          scope_mode: "project",
          project_id: "PJ-001",
          active: true,
        },
        {
          domain: "prjops",
          profile: "PRF-04",
          scope_mode: "project",
          project_id: "PJ-001",
          active: true,
        },
        {
          domain: "prjops",
          profile: "PRF-05",
          scope_mode: "project",
          project_id: "PJ-001",
          active: true,
        },
      ],
      invested_project_ids: ["PJ-001"],
      email: "allowed@example.com",
      teams_user_id: "teams-allowed",
      preferred_language: "ja",
      timezone: "Asia/Tokyo",
      ...lifecycle,
    },
    "stakeholders/ST-002.yaml": {
      id: "ST-002",
      name: "Denied User",
      organization_id: "ORG-001",
      entra_tenant_id: "33333333-3333-3333-3333-333333333333",
      entra_object_id: "44444444-4444-4444-4444-444444444444",
      assignments: [
        {
          domain: "prjops",
          profile: "PRF-02",
          scope_mode: "project",
          project_id: "PJ-002",
          active: true,
        },
      ],
      invested_project_ids: [],
      email: "denied@example.com",
      teams_user_id: "teams-denied",
      preferred_language: "ja",
      timezone: "Asia/Tokyo",
      ...lifecycle,
    },
    "issues/ISSUE-001.yaml": {
      id: "ISSUE-001",
      project_id: "PJ-001",
      title: "Allowed issue",
      detail: "",
      severity: "high",
      severity_proposed: null,
      status: "open",
      closed_by: null,
      closed_reason: null,
      ...lifecycle,
    },
    "issues/ISSUE-002.yaml": {
      id: "ISSUE-002",
      project_id: "PJ-002",
      title: "Denied issue",
      detail: "",
      severity: "critical",
      severity_proposed: null,
      status: "open",
      closed_by: null,
      closed_reason: null,
      ...lifecycle,
    },
    "actions/ACT-001.yaml": {
      id: "ACT-001",
      project_id: "PJ-001",
      title: "Allowed action",
      assignee: "ST-001",
      due: "2026-12-01",
      status: "open",
      reminders_sent: [],
      ...lifecycle,
    },
    "actions/ACT-002.yaml": {
      id: "ACT-002",
      project_id: "PJ-002",
      title: "Denied action",
      assignee: "ST-002",
      due: "2026-12-01",
      status: "open",
      reminders_sent: [],
      ...lifecycle,
    },
    "status_updates/SU-001.yaml": {
      id: "SU-001",
      project_id: "PJ-001",
      period: { start: "2026-06-01", end: "2026-06-08" },
      channel: "web",
      reporter: "ST-001",
      progress_pct: 50,
      self_status: "green",
      achievements: "",
      plans: "",
      issues: [],
      risks: [],
      complete: true,
      raw_source: "audit/allowed",
      ...lifecycle,
    },
    "status_updates/SU-002.yaml": {
      id: "SU-002",
      project_id: "PJ-002",
      period: { start: "2026-06-01", end: "2026-06-08" },
      channel: "web",
      reporter: "ST-002",
      progress_pct: 10,
      self_status: "red",
      achievements: "",
      plans: "",
      issues: [],
      risks: [],
      complete: true,
      raw_source: "audit/denied",
      ...lifecycle,
    },
    "seven_keys/questionnaires/SKQ-001.yaml": {
      id: "SKQ-001",
      project_id: "PJ-001",
      month: "2026-06",
      answers: {
        stakeholders_committed: "green",
        business_benefits: "yellow",
        risk_mitigation: "green",
        delivery_org_benefits: "yellow",
      },
      ...lifecycle,
    },
    "seven_keys/questionnaires/SKQ-002.yaml": {
      id: "SKQ-002",
      project_id: "PJ-002",
      month: "2026-06",
      answers: {
        stakeholders_committed: "red",
        business_benefits: "red",
        risk_mitigation: "red",
        delivery_org_benefits: "red",
      },
      ...lifecycle,
    },
    "seven_keys/snapshots/SKS-001.yaml": {
      id: "SKS-001",
      project_id: "PJ-001",
      month: "2026-06",
      name: "Allowed",
      keys: ["K1", "K2", "K3", "K4", "K5", "K6", "K7"].map((key_id) => ({
        key_id,
        rag: "green",
        basis: "validated",
      })),
      improved_keys: ["K1"],
      worsened_keys: [],
      trace_id: "trace-allowed",
      created_at: "2026-07-01T00:00:00Z",
    },
    "seven_keys/snapshots/SKS-002.yaml": {
      id: "SKS-002",
      project_id: "PJ-002",
      month: "2026-06",
      name: "Denied",
      keys: ["K1", "K2", "K3", "K4", "K5", "K6", "K7"].map((key_id) => ({
        key_id,
        rag: "red",
        basis: "denied",
      })),
      improved_keys: [],
      worsened_keys: ["K1"],
      trace_id: "trace-denied",
      created_at: "2026-07-01T00:00:00Z",
    },
    "investor/financial_inputs.yaml": {
      currency: "JPY",
      as_of: "2026-06-30",
      projects: [
        { project_id: "PJ-001", ownership_pct: 100, revenue: 100, ebitda: 10 },
        { project_id: "PJ-002", ownership_pct: 100, revenue: 999, ebitda: 99 },
      ],
      updated_at: "2026-07-01T00:00:00Z",
      updated_by: "ST-001",
    },
    "investor/board_pack.yaml": {
      targets: { revenue: 200, ebitda: 20 },
      history: [
        {
          as_of: "2026-03-31",
          companies: [
            { project_id: "PJ-001", ownership_pct: 100, revenue: 80, ebitda: 8 },
            { project_id: "PJ-002", ownership_pct: 100, revenue: 900, ebitda: 90 },
          ],
        },
      ],
      updated_at: "2026-07-01T00:00:00Z",
      updated_by: "ST-001",
    },
  };
  const dataEntries = Object.entries(documents).map(([path, document]) => entry(path, document));
  const manifest = buildPrjopsDataManifest(dataEntries);
  if (!manifest.ok) throw new Error(manifest.code);
  return {
    checksum: manifest.contentSha256,
    entries: [
      entry("schema/version.yaml", {
        schema_version: "1.0.0",
        generated_at: "2026-07-01T00:00:00Z",
        content_sha256: manifest.contentSha256,
      }),
      ...dataEntries,
    ],
  };
}

function sourceFor(entries: SnapshotEntry[]): PrjopsSnapshotSource & { load: ReturnType<typeof vi.fn> } {
  return { load: vi.fn(async () => ({ commitSha: COMMIT, entries })) };
}

const visibility = {
  recipientStakeholderId: "ST-001",
  recipientManagedProjectIds: [],
  recipientAssignedProjectIds: ["PJ-001"],
  recipientParticipatingProjectIds: [],
  investedProjectIds: [],
  scopeMode: "project" as const,
};

describe("PinnedPrjopsReportDataProvider [P010-F02-T07]", () => {
  it("provider query自体にpersona/stakeholder/project条件を渡し、scope外recordを一件も返さない", async () => {
    const fixture = snapshot();
    const source = sourceFor(fixture.entries);
    const provider = new PinnedPrjopsReportDataProvider(source, COMMIT, fixture.checksum, () => new Date("2026-07-01"));
    const query = vi.spyOn(provider, "query");

    const report = await buildManagerSummary(provider, "PRF-02", visibility, "2026-01-01", "2026-12-31");

    expect(query).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith({ profile: "PRF-02", visibility });
    expect(source.load).toHaveBeenCalledOnce();
    expect(report.projects.map((project) => project.projectId)).toEqual(["PJ-001"]);
    expect(report.totalTicketCount).toBe(2);
    expect(JSON.stringify(report)).not.toContain("PJ-002");
    const scoped = await provider.query({ profile: "PRF-02", visibility });
    expect(scoped.sevenKeysQuestionnaires).toEqual([]);
    expect(scoped.sevenKeysMonthlySnapshots).toEqual([]);
    expect(scoped.projects[0]).toMatchObject({ ownerName: "Allowed User", revenue: undefined });
    expect(JSON.stringify(scoped)).not.toContain("999");

    const executive = await provider.query({
      profile: "PRF-04",
      visibility: { ...visibility, recipientAssignedProjectIds: [], recipientManagedProjectIds: ["PJ-001"] },
    });
    expect(executive.sevenKeysQuestionnaires.map((item) => item.projectId)).toEqual(["PJ-001"]);
    expect(executive.sevenKeysMonthlySnapshots.map((item) => item.projectId)).toEqual(["PJ-001"]);
    expect(executive.projects[0]?.ownerName).toBe("");

    const investor = await provider.query({
      profile: "PRF-05",
      visibility: { ...visibility, recipientAssignedProjectIds: [], investedProjectIds: ["PJ-001"] },
    });
    expect(investor.projects[0]).toMatchObject({ projectId: "PJ-001", revenue: 100, ownerName: "" });
    expect(investor.investorBoardPackInputs.history?.[0]?.companies.map((company) => company.projectId)).toEqual([
      "PJ-001",
    ]);
  });

  it("stable subjectを毎回validated snapshotへ照会し、request間cacheを持たない", async () => {
    const fixture = snapshot();
    const source = sourceFor(fixture.entries);
    const provider = new PinnedPrjopsReportDataProvider(source, COMMIT, fixture.checksum);

    await expect(provider.findBySubject(SUBJECT)).resolves.toHaveLength(3);
    await expect(provider.findBySubject(SUBJECT)).resolves.toHaveLength(3);
    expect(source.load).toHaveBeenCalledTimes(2);
  });

  it("stale/foreign project scopeを空200へ変換せず403で拒否する", async () => {
    const fixture = snapshot();
    const provider = new PinnedPrjopsReportDataProvider(sourceFor(fixture.entries), COMMIT, fixture.checksum);
    const denied = { ...visibility, recipientAssignedProjectIds: ["PJ-002"] };

    await expect(provider.query({ profile: "PRF-02", visibility: denied })).rejects.toBeInstanceOf(
      PrjopsDataAccessDeniedError,
    );
  });

  it("commit、owner checksum、partial/corrupt snapshot不一致を503でfail closedにする", async () => {
    const fixture = snapshot();
    const commitMismatch = {
      load: vi.fn(async () => ({ commitSha: "2".repeat(40), entries: fixture.entries })),
    };
    await expect(
      new PinnedPrjopsReportDataProvider(commitMismatch, COMMIT, fixture.checksum).query({
        profile: "PRF-02",
        visibility,
      }),
    ).rejects.toBeInstanceOf(PrjopsDataUnavailableError);

    await expect(
      new PinnedPrjopsReportDataProvider(sourceFor(fixture.entries), COMMIT, "f".repeat(64)).query({
        profile: "PRF-02",
        visibility,
      }),
    ).rejects.toBeInstanceOf(PrjopsDataUnavailableError);

    for (const entries of [
      fixture.entries.filter((item) => item.path !== "investor/board_pack.yaml"),
      fixture.entries.map((item) =>
        item.path === "projects/PJ-001.yaml" ? { ...item, bytes: Buffer.from("id: [\n") } : item,
      ),
    ]) {
      await expect(
        new PinnedPrjopsReportDataProvider(sourceFor(entries), COMMIT, fixture.checksum).query({
          profile: "PRF-02",
          visibility,
        }),
      ).rejects.toBeInstanceOf(PrjopsDataUnavailableError);
    }
  });

  it("503 errorをHTTP 503へ変換し、factoryは欠落設定を空providerにfallbackしない", () => {
    expect(toErrorResponse(new PrjopsDataUnavailableError("test")).status).toBe(503);
    const config = loadWebConfig({
      AUTH_SECRET: "auth-secret",
      AUTH_MICROSOFT_ENTRA_ID_ID: "client-id",
      AUTH_MICROSOFT_ENTRA_ID_SECRET: "client-secret",
      AUTH_MICROSOFT_ENTRA_ID_TENANT_ID: "tenant-id",
      DATABASE_URL: "postgres://example",
      PUBLIC_BASE_URL: "https://example.invalid",
    });
    expect(() => createPinnedPrjopsReportDataProvider(config)).toThrow(PrjopsDataUnavailableError);
  });

  it("filesystem sourceはexport rootを毎回走査してvalidatorへregular entriesを渡す", async () => {
    const fixture = snapshot();
    const root = await mkdtemp(join(tmpdir(), "aiops-prjops-snapshot-"));
    try {
      for (const item of fixture.entries) {
        const path = join(root, item.path);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, item.bytes);
      }
      const source = new FileSystemPrjopsSnapshotSource(await realpath(root), COMMIT);
      const loaded = await source.load();
      expect(loaded.commitSha).toBe(COMMIT);
      expect(loaded.entries).toHaveLength(fixture.entries.length);
      expect(loaded.entries.every((item) => item.kind === "regular")).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
