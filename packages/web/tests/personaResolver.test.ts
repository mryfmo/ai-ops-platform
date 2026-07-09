/**
 * packages/web/tests/personaResolver.test.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。
 *   CLAUDE.md設計原則6（recipientsのactive判定はリクエスト毎、キャッシュ禁止）と
 *   devops/lib/reportPermissionFilter.ts の isActiveRecipient と同じ制約をWebUI側でも
 *   検証する。あわせて PrjOps側 InMemoryStakeholderMasterProvider の解決も検証する。
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

function fakeDb(rows: Array<Record<string, unknown>>): PgQueryable {
  return {
    query: vi.fn().mockResolvedValue({ rows }),
  };
}

describe("DevopsPersonaSource（ADR-0005 / CLAUDE.md設計原則6: recipientsはリクエスト毎照会）", () => {
  it("active=trueのrecipientsのみをdevopsペルソナとして解決する", async () => {
    const db = fakeDb([
      { user_id: "U1", profile: "PRF-L", projects: ["PRJ-0001"], active: true, email: "a@example.com" },
      { user_id: "U2", profile: "PRF-M", projects: [], active: false, email: "a@example.com" },
    ]);
    const source = new DevopsPersonaSource(db);
    const personas = await source.resolveByEmail("a@example.com");
    expect(personas).toHaveLength(1);
    expect(personas[0]).toEqual({
      domain: "devops",
      profile: "PRF-L",
      visibility: { recipientUserId: "U1", recipientAssignedProjectIds: ["PRJ-0001"] },
    });
  });

  it("該当するrecipientsが無い場合は空配列を返す", async () => {
    const db = fakeDb([]);
    const source = new DevopsPersonaSource(db);
    const personas = await source.resolveByEmail("nobody@example.com");
    expect(personas).toEqual([]);
  });

  it("全レコードがinactiveの場合は空配列を返す", async () => {
    const db = fakeDb([{ user_id: "U3", profile: "PRF-G", projects: [], active: false, email: "b@example.com" }]);
    const source = new DevopsPersonaSource(db);
    const personas = await source.resolveByEmail("b@example.com");
    expect(personas).toEqual([]);
  });

  it("問い合わせはメソッド呼び出しの都度実行され、結果をキャッシュしない（呼び出し毎に最新のDB応答を反映する）", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{ user_id: "U1", profile: "PRF-M", projects: [], active: true, email: "c@example.com" }],
      })
      .mockResolvedValueOnce({
        rows: [{ user_id: "U1", profile: "PRF-M", projects: [], active: false, email: "c@example.com" }],
      });
    const db: PgQueryable = { query };
    const source = new DevopsPersonaSource(db);

    const first = await source.resolveByEmail("c@example.com");
    const second = await source.resolveByEmail("c@example.com");

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
    expect(query).toHaveBeenCalledTimes(2);
  });
});

describe("PrjopsPersonaSource + InMemoryStakeholderMasterProvider（ADR-0005: 開発/テスト用フィクスチャ）", () => {
  const records: StakeholderRecord[] = [
    {
      stakeholderId: "STK-001",
      email: "pm@example.com",
      profile: "PRF-03",
      managedProjectIds: ["PRJ-0001", "PRJ-0002"],
      assignedProjectIds: [],
      participatingProjectIds: [],
      investedProjectIds: [],
    },
    {
      stakeholderId: "STK-002",
      email: "member@example.com",
      profile: "PRF-01",
      managedProjectIds: [],
      assignedProjectIds: [],
      participatingProjectIds: ["PRJ-0003"],
      investedProjectIds: [],
    },
    {
      stakeholderId: "STK-INV",
      email: "investor@example.com",
      profile: "PRF-05",
      managedProjectIds: [],
      assignedProjectIds: [],
      participatingProjectIds: [],
      investedProjectIds: ["PRJ-0009"],
    },
  ];

  it("emailに一致するステークホルダーのペルソナを解決する", async () => {
    const provider = new InMemoryStakeholderMasterProvider(records);
    const source = new PrjopsPersonaSource(provider);
    const personas = await source.resolveByEmail("pm@example.com");
    expect(personas).toEqual([
      {
        domain: "prjops",
        profile: "PRF-03",
        visibility: {
          recipientStakeholderId: "STK-001",
          recipientManagedProjectIds: ["PRJ-0001", "PRJ-0002"],
          recipientAssignedProjectIds: [],
          recipientParticipatingProjectIds: [],
          investedProjectIds: [],
        },
      },
    ]);
  });

  it("該当ステークホルダーが無い場合は空配列を返す", async () => {
    const provider = new InMemoryStakeholderMasterProvider(records);
    const source = new PrjopsPersonaSource(provider);
    const personas = await source.resolveByEmail("unknown@example.com");
    expect(personas).toEqual([]);
  });

  it("PRF-05をinvestorペルソナとして解決する [REQ-039, SPEC-INT-066]", async () => {
    const provider = new InMemoryStakeholderMasterProvider(records);
    const source = new PrjopsPersonaSource(provider);
    const personas = await source.resolveByEmail("investor@example.com");
    expect(personas).toEqual([
      {
        domain: "investor",
        profile: "investor",
        visibility: {
          recipientStakeholderId: "STK-INV",
          recipientManagedProjectIds: [],
          recipientAssignedProjectIds: [],
          recipientParticipatingProjectIds: [],
          investedProjectIds: ["PRJ-0009"],
        },
      },
    ]);
  });
});

describe("CompositePersonaResolver（ADR-0005: DevOps/PrjOps両ドメインの合成）", () => {
  it("同一emailがPrjOps/DevOps両方に存在する場合、両ドメインのペルソナを返す", async () => {
    const db = fakeDb([{ user_id: "U9", profile: "PRF-G", projects: [], active: true, email: "both@example.com" }]);
    const stakeholders: StakeholderRecord[] = [
      {
        stakeholderId: "STK-009",
        email: "both@example.com",
        profile: "PRF-04",
        managedProjectIds: [],
        assignedProjectIds: [],
        participatingProjectIds: [],
        investedProjectIds: [],
      },
    ];
    const resolver = new CompositePersonaResolver(
      new DevopsPersonaSource(db),
      new PrjopsPersonaSource(new InMemoryStakeholderMasterProvider(stakeholders)),
    );
    const personas = await resolver.resolveByEmail("both@example.com");
    expect(personas).toHaveLength(2);
    expect(personas.some((p) => p.domain === "devops")).toBe(true);
    expect(personas.some((p) => p.domain === "prjops")).toBe(true);
  });

  it("該当ペルソナが1件も無い場合は空配列を返す", async () => {
    const db = fakeDb([]);
    const resolver = new CompositePersonaResolver(
      new DevopsPersonaSource(db),
      new PrjopsPersonaSource(new InMemoryStakeholderMasterProvider([])),
    );
    const personas = await resolver.resolveByEmail("nobody@example.com");
    expect(personas).toEqual([]);
  });
});
