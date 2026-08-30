// 根拠: ADR-0030 / ADR-0005 / FinalArch:FR-CP-001
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dockerfile = readFileSync(new URL("../../server/Dockerfile", import.meta.url), "utf8");
const supervisor = readFileSync(new URL("../../server/scripts/start-container.mjs", import.meta.url), "utf8");
const entry = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
const bootstrap = readFileSync(new URL("../../server/src/bootstrap.ts", import.meta.url), "utf8");
const serverPackage = JSON.parse(readFileSync(new URL("../../server/package.json", import.meta.url), "utf8"));

describe("production composition packaging [ADR-0030] [ADR-0005] [FinalArch:FR-CP-001]", () => {
  it("keeps the telemetry-safe bootstrap separate from the delayed server import", () => {
    expect(bootstrap).toMatch(
      /^\/\/[^\n]+\n\/\/[^\n]+\nexport \{ loadConfig \}[^\n]+\nexport \{ createLogger \}[^\n]+\nexport \{ startTelemetry \}[^\n]+\n$/,
    );
    expect(entry).toContain('from "@aiops/server/bootstrap"');
    expect(entry).toContain('import("@aiops/server")');
    expect(entry.indexOf("await dependencies.startTelemetry")).toBeLessThan(
      entry.indexOf("await dependencies.loadRuntime"),
    );
    expect(serverPackage).toMatchObject({
      main: "dist/index.js",
      types: "dist/index.d.ts",
      exports: {
        ".": { types: "./dist/index.d.ts", import: "./dist/index.js", default: "./dist/index.js" },
        "./bootstrap": {
          types: "./dist/bootstrap.d.ts",
          import: "./dist/bootstrap.js",
          default: "./dist/bootstrap.js",
        },
      },
    });
  });

  it("builds and deploys the composition dependency closure without runtime source trees", () => {
    expect(dockerfile).toContain("pnpm --filter '@aiops/composition...' run build");
    expect(dockerfile).toContain("pnpm --filter @aiops/composition deploy --prod --legacy /out/composition");
    for (const packageName of ["shared", "policy", "integrations", "prjops", "devops", "control-plane", "server"]) {
      expect(dockerfile).toContain(packageName);
    }
    expect(dockerfile).toContain("/out/composition/node_modules");
    expect(dockerfile).not.toContain("/out/server");
  });

  it("starts the image through composition rather than the old server entry", () => {
    expect(supervisor).toContain('launch("server", "node", ["packages/composition/dist/main.js"]);');
    expect(supervisor).not.toContain('launch("server", "node", ["packages/server/dist/main.js"]);');
  });
});
