// 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-003 / FinalArch:FR-UI-006 / ADR-0025 / UX-005

const HANDOFF_PATH = "/app/api/workbench/handoff";
const TOKEN = /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/u;

declare const verifiedWorkbenchHandoffUrl: unique symbol;
export type VerifiedWorkbenchHandoffUrl = string & { readonly [verifiedWorkbenchHandoffUrl]: true };

export interface BuildWorkbenchHandoffCardInput {
  url: VerifiedWorkbenchHandoffUrl;
}

export interface WorkbenchHandoffAdaptiveCard {
  $schema: "http://adaptivecards.io/schemas/adaptive-card.json";
  type: "AdaptiveCard";
  version: "1.5";
  body: [
    { type: "TextBlock"; text: "AI Workbench で開く"; weight: "Bolder" },
    { type: "TextBlock"; text: "現在のワークフローを安全な短期リンクで開きます。"; wrap: true },
  ];
  actions: [{ type: "Action.OpenUrl"; title: "Workbench を開く"; url: string }];
}

export function verifyWorkbenchHandoffUrl(value: string, expectedOrigin: string): VerifiedWorkbenchHandoffUrl {
  let url: URL;
  let expected: URL;
  try {
    url = new URL(value);
    expected = new URL(expectedOrigin);
  } catch {
    throw new Error("Invalid Workbench handoff URL");
  }
  const queryKeys = [...url.searchParams.keys()];
  if (
    url.protocol !== "https:" ||
    expected.protocol !== "https:" ||
    expected.username ||
    expected.password ||
    expected.pathname !== "/" ||
    expected.search ||
    expected.hash ||
    url.origin !== expected.origin ||
    url.username ||
    url.password ||
    url.pathname !== HANDOFF_PATH ||
    url.hash ||
    queryKeys.length !== 1 ||
    queryKeys[0] !== "token" ||
    !TOKEN.test(url.searchParams.get("token") ?? "")
  ) {
    throw new Error("Invalid Workbench handoff URL");
  }
  return url.toString() as VerifiedWorkbenchHandoffUrl;
}

export function buildWorkbenchHandoffCard(input: BuildWorkbenchHandoffCardInput): WorkbenchHandoffAdaptiveCard {
  return {
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    type: "AdaptiveCard",
    version: "1.5",
    body: [
      { type: "TextBlock", text: "AI Workbench で開く", weight: "Bolder" },
      { type: "TextBlock", text: "現在のワークフローを安全な短期リンクで開きます。", wrap: true },
    ],
    actions: [{ type: "Action.OpenUrl", title: "Workbench を開く", url: input.url }],
  };
}
