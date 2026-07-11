/**
 * 根拠: ADR-0005（Teams RSC は実装で使う team-scoped 権限だけを宣言する）
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(
  readFileSync(new URL("../../../docs/teams-app/manifest.json", import.meta.url), "utf8"),
) as {
  $schema?: string;
  manifestVersion?: string;
  authorization?: { permissions?: { resourceSpecific?: Array<{ name: string; type: string }> } };
};
const readme = readFileSync(new URL("../../../docs/teams-app/README.md", import.meta.url), "utf8");
const adr = readFileSync(
  new URL("../../../docs/adr/0005-resident-server-and-teams-integration.md", import.meta.url),
  "utf8",
);

describe("Teams app manifest (ADR-0005)", () => {
  it("pins the schema URL and version without claiming schema-body validation", () => {
    expect(manifest.$schema).toBe(
      "https://developer.microsoft.com/en-us/json-schemas/teams/v1.17/MicrosoftTeams.schema.json",
    );
    expect(manifest.manifestVersion).toBe("1.17");
  });

  it("declares only the RSC permissions used for channel message ingestion and replies", () => {
    expect(manifest.authorization?.permissions?.resourceSpecific).toEqual([
      { name: "ChannelMessage.Read.Group", type: "Application" },
      { name: "ChannelMessage.Send.Group", type: "Application" },
    ]);
  });

  it("documents each declared permission's implementation use", () => {
    expect(readme).toContain("`ChannelMessage.Read.Group`: change notification後のメッセージ取得とpolling/backfill");
    expect(readme).toContain(
      "`ChannelMessage.Send.Group`: `GraphClient.sendAdaptiveCard`によるreport delivery/AGT-CHG/AGT-INC/AGT-DEPの通常root投稿と、`GraphClient.replyToMessage`による会話返信",
    );
    expect(readme).toContain(
      "root投稿 `POST /teams/{team-id}/channels/{channel-id}/messages` と返信 `POST /teams/{team-id}/channels/{channel-id}/messages/{message-id}/replies`",
    );
  });

  it("keeps the canonical ADR and deployment caveats aligned with the manifest", () => {
    expect(adr).toContain(
      "**チャネルメッセージ権限はRSC**: `ChannelMessage.Read.Group` / `ChannelMessage.Send.Group` のみ",
    );
    expect(adr).toContain("app-only通常root投稿・返信は実tenant未検証");
    expect(adr).toContain("Teamsアプリ自動インストールは未実装の将来要件");
    expect(readme).toContain("Teams app installation自動化は未実装");
    expect(readme).toContain("実schema validationはPlan008へ繰り延べる");
  });
});
