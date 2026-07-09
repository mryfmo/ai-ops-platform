import { describe, it, expect } from "vitest";
import { RecipientsRepo } from "../src/db/recipientsRepo.js";

describe("RecipientsRepo [REQ-042 SPEC-INT-069]", () => {
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
});
