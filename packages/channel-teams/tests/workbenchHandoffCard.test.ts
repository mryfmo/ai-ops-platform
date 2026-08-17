// 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-003 / FinalArch:FR-UI-006 / ADR-0025 / UX-005
import { describe, expect, it } from "vitest";

import {
  buildWorkbenchHandoffCard,
  verifyWorkbenchHandoffUrl,
  type BuildWorkbenchHandoffCardInput,
} from "../src/index.js";

const TOKEN = `v1.${Buffer.from('{"v":1}').toString("base64url")}.${"a".repeat(43)}`;
const URL = `https://workbench.example.test/app/api/workbench/handoff?token=${TOKEN}`;

// @ts-expect-error raw or LLM-originated strings cannot cross the render boundary
const unverifiedCardInput: BuildWorkbenchHandoffCardInput = { url: URL };
void unverifiedCardInput;

describe("FinalArch:FR-UI-003 Teams Workbench handoff card", () => {
  it("builds one local open-url action for the verified Workbench origin", () => {
    const verifiedUrl = verifyWorkbenchHandoffUrl(URL, "https://workbench.example.test");
    expect(buildWorkbenchHandoffCard({ url: verifiedUrl })).toEqual({
      $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
      type: "AdaptiveCard",
      version: "1.5",
      body: [
        { type: "TextBlock", text: "AI Workbench で開く", weight: "Bolder" },
        { type: "TextBlock", text: "現在のワークフローを安全な短期リンクで開きます。", wrap: true },
      ],
      actions: [{ type: "Action.OpenUrl", title: "Workbench を開く", url: URL }],
    });
  });

  it.each([
    ["HTTP", URL.replace("https:", "http:")],
    ["wrong origin", URL.replace("workbench.example.test", "evil.example.test")],
    ["fragment", `${URL}#secret`],
    ["extra query", `${URL}&next=https://evil.example.test`],
    ["unsigned", "https://workbench.example.test/app/api/workbench/handoff?token=unsigned"],
    ["wrong path", URL.replace("/handoff", "/other")],
  ])("rejects %s handoff URL", (_label, url) => {
    expect(() => verifyWorkbenchHandoffUrl(url, "https://workbench.example.test")).toThrow(
      "Invalid Workbench handoff URL",
    );
  });
});
