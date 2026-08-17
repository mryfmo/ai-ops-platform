/** 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-003 / FinalArch:FR-UI-004 / FinalArch:FR-UI-005 / FinalArch:FR-UI-006 / ADR-0025 / UX-003 / UX-005 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { GadgetView } from "../src/components/workbench/GadgetView.js";
import { GADGET_COMPONENTS, parseGadgetViewSpec, type GadgetViewSpec } from "../src/server/viewSpec.js";
import type { WorkbenchWorkspace } from "../src/server/workbenchClient.js";

const WORKSPACE_ID = "33333333-3333-4333-8333-333333333333";
const SOURCE_REF_ID = "44444444-4444-4444-8444-444444444444";
const OPERATION_ID = "55555555-5555-4555-8555-555555555555";
const APPROVAL_ID = "66666666-6666-4666-8666-666666666666";
const DECISION_ID = "77777777-7777-4777-8777-777777777777";
const resource = { resourceType: "project", resourceId: "PJ-001" } as const;

const workspace: WorkbenchWorkspace = {
  workspaceId: WORKSPACE_ID,
  kind: "project",
  projectId: "PJ-001",
  ownerUserId: "leader-1",
  createdAt: "2026-08-17T00:00:00.000Z",
  sources: [
    {
      sourceRefId: SOURCE_REF_ID,
      sourceSystem: "github",
      sourceType: "repository",
      externalId: "mryfmo/ai-ops-platform",
      canonicalUrl: "https://github.com/mryfmo/ai-ops-platform",
    },
  ],
  runs: [
    {
      workflowId: "incident/inc-1",
      runId: "run-1",
      workflowType: "incident",
      status: "running",
      currentStep: "一次切り分け",
      updatedAt: "2026-08-17T00:01:00.000Z",
    },
  ],
  pendingActions: [
    {
      operationId: OPERATION_ID,
      approvalId: APPROVAL_ID,
      workflowId: "incident/inc-1",
      actionStatus: "approval_pending",
      approvalStatus: "pending",
    },
  ],
  grant: {
    ...resource,
    policyBundleVersion: "0.2.0",
    decisionId: DECISION_ID,
  },
};

const fixtures = [
  {
    kind: "gadget",
    component: "workflowTimeline",
    workspaceId: WORKSPACE_ID,
    resource,
    workflowId: "incident/inc-1",
  },
  {
    kind: "gadget",
    component: "sourcePanel",
    workspaceId: WORKSPACE_ID,
    resource,
    sourceRefId: SOURCE_REF_ID,
  },
  {
    kind: "gadget",
    component: "pendingActions",
    workspaceId: WORKSPACE_ID,
    resource,
    approvalStatus: "pending",
  },
  {
    kind: "gadget",
    component: "decisionSummary",
    workspaceId: WORKSPACE_ID,
    resource,
  },
] as const;

const typedFixture: GadgetViewSpec = fixtures[0];
// @ts-expect-error arbitrary code is not part of the approved catalog
const arbitraryCodeSpec: GadgetViewSpec = { ...typedFixture, code: "return fetch('https://evil.example')" };
// @ts-expect-error network targets are not representable in a GadgetViewSpec
const networkSpec: GadgetViewSpec = { ...typedFixture, url: "https://evil.example" };
// @ts-expect-error event handler strings are not representable in a GadgetViewSpec
const handlerSpec: GadgetViewSpec = { ...typedFixture, onClick: "eval(payload)" };
// @ts-expect-error only catalog components are assignable
const unapprovedSpec: GadgetViewSpec = { ...typedFixture, component: "iframe" };
void [arbitraryCodeSpec, networkSpec, handlerSpec, unapprovedSpec];

describe("FinalArch:FR-UI-003/004/005 typed Gadget/ViewSpec", () => {
  it("fixes the approved component catalog", () => {
    expect(GADGET_COMPONENTS).toEqual(["workflowTimeline", "sourcePanel", "pendingActions", "decisionSummary"]);
  });

  it("renders the four approved components deterministically", () => {
    const first = fixtures.map((fixture) =>
      renderToStaticMarkup(<GadgetView spec={parseGadgetViewSpec(fixture)} workspace={workspace} />),
    );
    const second = fixtures.map((fixture) =>
      renderToStaticMarkup(<GadgetView spec={parseGadgetViewSpec(fixture)} workspace={workspace} />),
    );

    expect(first).toEqual(second);
    expect(first).toMatchSnapshot();
  });

  it.each([
    ["unapproved component", { ...fixtures[0], component: "iframe" }],
    ["arbitrary code", { ...fixtures[0], code: "return process.env" }],
    ["HTML", { ...fixtures[0], html: "<script>alert(1)</script>" }],
    ["event handler", { ...fixtures[0], onClick: "eval(payload)" }],
    ["external URL", { ...fixtures[0], url: "https://evil.example/collect" }],
    [
      "URL-shaped resource reference",
      { ...fixtures[0], resource: { ...resource, resourceId: "https://evil.example" } },
    ],
    ["fetch target", { ...fixtures[0], fetch: "https://evil.example/data" }],
    ["expression", { ...fixtures[0], expression: "globalThis.location" }],
    ["script-like reference", { ...fixtures[0], workflowId: "<script>alert(1)</script>" }],
    ["resource extra field", { ...fixtures[0], resource: { ...resource, url: "https://evil.example" } }],
  ])("rejects %s at the strict parser boundary", (_name, candidate) => {
    expect(() => parseGadgetViewSpec(candidate)).toThrow();
  });

  it.each([
    ["wrong workspace", { ...fixtures[0], workspaceId: "88888888-8888-4888-8888-888888888888" }],
    ["wrong resource", { ...fixtures[0], resource: { ...resource, resourceId: "PJ-002" } }],
    ["grant-external workflow", { ...fixtures[0], workflowId: "incident/inc-foreign" }],
    ["grant-external source", { ...fixtures[1], sourceRefId: "99999999-9999-4999-8999-999999999999" }],
  ])("fails closed for %s", (_name, candidate) => {
    expect(() =>
      renderToStaticMarkup(<GadgetView spec={parseGadgetViewSpec(candidate)} workspace={workspace} />),
    ).toThrow("E-GADGET-SCOPE");
  });

  it("renders already-acquired references without initiating a network request", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    for (const fixture of fixtures) {
      renderToStaticMarkup(<GadgetView spec={parseGadgetViewSpec(fixture)} workspace={workspace} />);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("lets React escape reference text instead of passing markup through", () => {
    const markedWorkspace: WorkbenchWorkspace = {
      ...workspace,
      sources: [{ ...workspace.sources[0]!, externalId: "<script>alert(1)</script>" }],
    };
    const markup = renderToStaticMarkup(
      <GadgetView spec={parseGadgetViewSpec(fixtures[1])} workspace={markedWorkspace} />,
    );

    expect(markup).not.toContain("<script>");
    expect(markup).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx", ".js", ".mjs", ".json"].includes(extname(entry.name)) ? [path] : [];
  });
}

describe("FinalArch:ADR-0025 web runtime inventory", () => {
  it("has no Cloudflare dependency, import, or configuration surface", () => {
    const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const forbidden = /cloudflare|wrangler/iu;
    const rootEntries = readdirSync(webRoot, { withFileTypes: true });
    const rootNames = rootEntries.map((entry) => entry.name).join("\n");
    const rootConfigFiles = rootEntries
      .filter(
        (entry) =>
          entry.isFile() &&
          (entry.name.startsWith(".env") ||
            [".json", ".js", ".mjs", ".ts", ".toml", ".yaml", ".yml"].includes(extname(entry.name))),
      )
      .map((entry) => resolve(webRoot, entry.name));
    const inspectedFiles = [...rootConfigFiles, ...sourceFiles(resolve(webRoot, "src"))].filter(existsSync);

    expect(rootNames).not.toMatch(forbidden);
    for (const path of inspectedFiles) expect(readFileSync(path, "utf8")).not.toMatch(forbidden);
  });
});
