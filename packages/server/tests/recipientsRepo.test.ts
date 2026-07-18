import { describe, it, expect } from "vitest";
import { RecipientsRepo } from "../src/db/recipientsRepo.js";

describe("RecipientsRepo [PrjOps:REQ-042 SPEC-INT-069]", () => {
  it("配信用recipientをDBから読み直す", async () => {
    const repo = new RecipientsRepo({
      query: async () => ({
        rows: [
          {
            user_id: "ST-001",
            profile: "PRF-05",
            persona: "investor",
            email: "investor@example.com",
            projects: ["PJ-001"],
            language: "en",
            active: true,
            teams_team_id: "team-1",
            teams_channel_id: "channel-1",
          },
        ],
      }),
    });
    const recipients = await repo.listForDelivery();
    expect(recipients[0]).toMatchObject({
      userId: "ST-001",
      profile: "PRF-05",
      persona: "investor",
      teamsChannelId: "channel-1",
    });
  });

  it("P010-F02-T03 / DEC-SPEC-002: active stable subjectをtenant/object完全一致で毎回取得する", async () => {
    const queries: Array<{ text: string; params?: unknown[] }> = [];
    const repo = new RecipientsRepo(
      {
        query: async (text, params) => {
          queries.push({ text, params });
          return {
            rows: [
              {
                user_id: "ST-001",
                profile: "PRF-02",
                persona: "manager",
                email: "manager@example.com",
                projects: ["PJ-001"],
                language: "ja",
                active: true,
                teams_team_id: null,
                teams_channel_id: null,
              },
            ],
          };
        },
      },
      "11111111-1111-4111-8111-111111111111",
    );

    await expect(
      repo.findActiveBySubject("11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"),
    ).resolves.toMatchObject({ userId: "ST-001", active: true });
    expect(queries).toHaveLength(1);
    expect(queries[0]?.text).toContain("entra_tenant_id = $1::uuid");
    expect(queries[0]?.text).toContain("entra_object_id = $2::uuid");
    expect(queries[0]?.text).toContain("active = true");
    expect(queries[0]?.text).toContain("backfill_state = 'applied'");
    expect(queries[0]?.params).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ]);
  });

  it("P010-F02-T03 / DEC-SPEC-002: foreign tenantはDB照会前に拒否する", async () => {
    let queried = false;
    const repo = new RecipientsRepo(
      {
        query: async () => {
          queried = true;
          return { rows: [] };
        },
      },
      "11111111-1111-4111-8111-111111111111",
    );

    await expect(
      repo.findActiveBySubject("99999999-9999-4999-8999-999999999999", "22222222-2222-4222-8222-222222222222"),
    ).resolves.toBeNull();
    expect(queried).toBe(false);
  });

  it("P010-F02-T03 / DEC-SPEC-002: tenant設定なしまたはmalformed objectはDB照会前に拒否する", async () => {
    let queries = 0;
    const db = {
      query: async () => {
        queries += 1;
        return { rows: [] };
      },
    };

    await expect(
      new RecipientsRepo(db).findActiveBySubject(
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ),
    ).resolves.toBeNull();
    await expect(
      new RecipientsRepo(db, "11111111-1111-4111-8111-111111111111").findActiveBySubject(
        "11111111-1111-4111-8111-111111111111",
        "not-a-uuid",
      ),
    ).resolves.toBeNull();
    expect(queries).toBe(0);
  });
});
