/**
 * packages/web/tests/personaResolver.test.ts
 *
 * 根拠: ADR-0005 / DevOps:SPEC-INT-054 / PrjOps:REQ-041。
 * stable subject とリクエスト時点の active assignment の積だけが persona になることを検証する。
 */
import { describe, expect, it, vi } from "vitest";
import type { PgQueryable } from "@aiops/shared";
import {
  CompositePersonaResolver,
  DevopsPersonaSource,
  InMemoryStakeholderMasterProvider,
  PrjopsPersonaSource,
  type StakeholderRecord,
} from "../src/server/personaResolver";

const SUBJECT = {
  tenantId: "11111111-1111-1111-1111-111111111111",
  objectId: "22222222-2222-2222-2222-222222222222",
};
const OTHER_SUBJECT = { ...SUBJECT, objectId: "33333333-3333-3333-3333-333333333333" };

function fakeDb(rows: Array<Record<string, unknown>>): PgQueryable {
  return { query: vi.fn().mockResolvedValue({ rows }) };
}

describe("DevopsPersonaSource [DevOps:SPEC-INT-054]", () => {
  it("stable subjectをactive/applied条件で毎回照会しproject assignmentを分離する", async () => {
    const db = fakeDb([
      {
        user_id: "U1",
        profile: "PRF-L",
        projects: ["PJ-002", "PJ-001"],
        scope_mode: "project",
        active: true,
        backfill_state: "applied",
      },
    ]);
    const source = new DevopsPersonaSource(db);

    await expect(source.resolveBySubject(SUBJECT)).resolves.toEqual([
      {
        domain: "devops",
        profile: "PRF-L",
        scope: { mode: "project", projectId: "PJ-001" },
        visibility: {
          recipientUserId: "U1",
          recipientAssignedProjectIds: ["PJ-001"],
          scopeMode: "project",
        },
      },
      {
        domain: "devops",
        profile: "PRF-L",
        scope: { mode: "project", projectId: "PJ-002" },
        visibility: {
          recipientUserId: "U1",
          recipientAssignedProjectIds: ["PJ-002"],
          scopeMode: "project",
        },
      },
    ]);
    await source.resolveBySubject(SUBJECT);

    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringMatching(/entra_tenant_id.*entra_object_id.*active.*backfill_state/s),
      [SUBJECT.tenantId, SUBJECT.objectId],
    );
  });

  it("globalはPRF-Gかつ空projectsだけを許可しnull/malformed/stale/inactiveをfail closedにする", async () => {
    const valid = new DevopsPersonaSource(
      fakeDb([
        {
          user_id: "U1",
          profile: "PRF-G",
          projects: [],
          scope_mode: "global",
          active: true,
          backfill_state: "applied",
        },
      ]),
    );
    await expect(valid.resolveBySubject(SUBJECT)).resolves.toEqual([
      {
        domain: "devops",
        profile: "PRF-G",
        scope: { mode: "global", projectId: null },
        visibility: { recipientUserId: "U1", recipientAssignedProjectIds: [], scopeMode: "global" },
      },
    ]);

    for (const row of [
      { user_id: "U1", profile: "PRF-L", projects: [], scope_mode: "global", active: true, backfill_state: "applied" },
      { user_id: "U1", profile: "PRF-G", projects: null, scope_mode: null, active: true, backfill_state: "applied" },
      { user_id: "U1", profile: "PRF-G", projects: [], scope_mode: "global", active: false, backfill_state: "applied" },
      { user_id: "U1", profile: "PRF-G", projects: [], scope_mode: "global", active: true, backfill_state: "pending" },
    ]) {
      await expect(new DevopsPersonaSource(fakeDb([row])).resolveBySubject(SUBJECT)).resolves.toEqual([]);
    }
  });

  it("別oidは同じemail属性でも一致せずpersonaを返さない", async () => {
    const db = fakeDb([]);
    const source = new DevopsPersonaSource(db);
    await expect(source.resolveBySubject(OTHER_SUBJECT)).resolves.toEqual([]);
    expect(db.query).toHaveBeenCalledWith(expect.any(String), [OTHER_SUBJECT.tenantId, OTHER_SUBJECT.objectId]);
  });
});

describe("PrjopsPersonaSource [PrjOps:REQ-041 / DevOps:SPEC-INT-054]", () => {
  const records: StakeholderRecord[] = [
    {
      stakeholderId: "ST-001",
      subject: SUBJECT,
      active: true,
      assignmentActive: true,
      domain: "prjops",
      profile: "PRF-03",
      scope: { mode: "project", projectId: "PJ-002" },
    },
    {
      stakeholderId: "ST-001",
      subject: SUBJECT,
      active: true,
      assignmentActive: true,
      domain: "prjops",
      profile: "PRF-01",
      scope: { mode: "project", projectId: "PJ-001" },
    },
    {
      stakeholderId: "ST-INV",
      subject: SUBJECT,
      active: true,
      assignmentActive: true,
      domain: "investor",
      profile: "PRF-05",
      scope: { mode: "project", projectId: "PJ-009" },
    },
  ];

  it("email変更に依存せずstable subject一致のassignmentを権限集約せず解決する", async () => {
    const source = new PrjopsPersonaSource(new InMemoryStakeholderMasterProvider(records));
    await expect(source.resolveBySubject(SUBJECT)).resolves.toEqual([
      {
        domain: "prjops",
        profile: "PRF-03",
        scope: { mode: "project", projectId: "PJ-002" },
        visibility: {
          recipientStakeholderId: "ST-001",
          recipientManagedProjectIds: ["PJ-002"],
          recipientAssignedProjectIds: [],
          recipientParticipatingProjectIds: [],
          investedProjectIds: [],
          scopeMode: "project",
        },
      },
      {
        domain: "prjops",
        profile: "PRF-01",
        scope: { mode: "project", projectId: "PJ-001" },
        visibility: {
          recipientStakeholderId: "ST-001",
          recipientManagedProjectIds: [],
          recipientAssignedProjectIds: [],
          recipientParticipatingProjectIds: ["PJ-001"],
          investedProjectIds: [],
          scopeMode: "project",
        },
      },
      {
        domain: "investor",
        profile: "investor",
        scope: { mode: "project", projectId: "PJ-009" },
        visibility: {
          recipientStakeholderId: "ST-INV",
          recipientManagedProjectIds: [],
          recipientAssignedProjectIds: [],
          recipientParticipatingProjectIds: [],
          investedProjectIds: ["PJ-009"],
          scopeMode: "project",
        },
      },
    ]);
  });

  it("inactive/stale assignmentと別oidを拒否する", async () => {
    const stale = records.map((record) => ({ ...record, assignmentActive: false }));
    const source = new PrjopsPersonaSource(new InMemoryStakeholderMasterProvider(stale));
    await expect(source.resolveBySubject(SUBJECT)).resolves.toEqual([]);
    await expect(
      new PrjopsPersonaSource(new InMemoryStakeholderMasterProvider(records)).resolveBySubject(OTHER_SUBJECT),
    ).resolves.toEqual([]);
  });
});

describe("CompositePersonaResolver [PrjOps:REQ-041 / DevOps:SPEC-INT-054]", () => {
  it("profile/domain/project順を固定し、同じsubjectの両domainを合成する", async () => {
    const db = fakeDb([
      {
        user_id: "U9",
        profile: "PRF-G",
        projects: [],
        scope_mode: "global",
        active: true,
        backfill_state: "applied",
      },
    ]);
    const stakeholders: StakeholderRecord[] = [
      {
        stakeholderId: "ST-009",
        subject: SUBJECT,
        active: true,
        assignmentActive: true,
        domain: "prjops",
        profile: "PRF-04",
        scope: { mode: "project", projectId: "PJ-009" },
      },
      {
        stakeholderId: "ST-009",
        subject: SUBJECT,
        active: true,
        assignmentActive: true,
        domain: "prjops",
        profile: "PRF-01",
        scope: { mode: "project", projectId: "PJ-001" },
      },
    ];
    const resolver = new CompositePersonaResolver(
      new DevopsPersonaSource(db),
      new PrjopsPersonaSource(new InMemoryStakeholderMasterProvider(stakeholders)),
    );

    const personas = await resolver.resolveBySubject(SUBJECT);
    expect(personas.map(({ domain, profile, scope }) => ({ domain, profile, scope }))).toEqual([
      { domain: "prjops", profile: "PRF-01", scope: { mode: "project", projectId: "PJ-001" } },
      { domain: "devops", profile: "PRF-G", scope: { mode: "global", projectId: null } },
      { domain: "prjops", profile: "PRF-04", scope: { mode: "project", projectId: "PJ-009" } },
    ]);
  });
});
