/**
 * packages/traceability/tests/verifyTraceability.test.ts
 *
 * 根拠: ADR-0004。T-P2-05是正証跡: AUD-VER-007 / AUD-TRC-001 / AUD-TRC-002。
 * 一時repo fixtureで必須仕様欠落とguard違反がCLI failureになることを検証する。
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runTraceabilityCli } from "../src/verifyTraceability.js";

const fixtures: string[] = [];
const missingAdr = (number: number): string => `ADR-${number}`;

function fixture(prjopsReqs: string[] = []): string {
  const root = mkdtempSync(join(tmpdir(), "aiops-traceability-"));
  fixtures.push(root);
  for (const dir of [
    "packages/traceability/spec-ids",
    "packages/traceability/output",
    "packages/shared/src",
    "packages/prjops/src",
    "packages/devops/src",
    "packages/server/src",
    "packages/web/src",
    "docs/adr",
  ]) {
    mkdirSync(join(root, dir), { recursive: true });
  }
  writeFileSync(
    join(root, "packages/traceability/spec-ids/prjops.json"),
    JSON.stringify({ system: "PrjOps", REQ: prjopsReqs }),
  );
  writeFileSync(join(root, "packages/traceability/spec-ids/devops.json"), JSON.stringify({ system: "DevOps" }));
  writeFileSync(join(root, "docs/adr/0004-toolchain.md"), "# ADR-0004\n");
  return root;
}

async function runFailure(root: string): Promise<{ code: number; stderr: string }> {
  const errors: string[] = [];
  const code = await runTraceabilityCli({
    repoRoot: root,
    writeOutput: false,
    stdout: () => undefined,
    stderr: (line) => errors.push(line),
  });
  return { code, stderr: errors.join("\n") };
}

afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("traceability CLI negative paths [ADR-0004 / AUD-VER-007]", () => {
  it("returns code one and E-TRACE01 when a mandatory REQ is absent [ADR-0004 / AUD-TRC-001]", async () => {
    const result = await runFailure(fixture(["REQ-999"]));
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("E-TRACE01");
    expect(result.stderr).toContain("REQ-999");
  });

  it("returns code one and E-TRACE01 for a missing ADR file [ADR-0004 / AUD-TRC-002]", async () => {
    const root = fixture();
    const id = missingAdr(9999);
    writeFileSync(join(root, "packages/web/src/missingAdr.ts"), `/** 根拠: ${id} */\nexport {};\n`);
    const result = await runFailure(root);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("E-TRACE01");
    expect(result.stderr).toContain(`ADR reference missing file: ${id}`);
  });

  it("ignores only the generated traceability output directory [ADR-0004 / AUD-TRC-002]", async () => {
    const root = fixture();
    const ignoredId = missingAdr(9998);
    const detectedId = missingAdr(9999);
    mkdirSync(join(root, "packages/web/output"), { recursive: true });
    writeFileSync(join(root, "packages/traceability/output/generated.md"), `${ignoredId}\n`);
    writeFileSync(join(root, "packages/web/output/real.md"), `${detectedId}\n`);
    const result = await runFailure(root);
    expect(result.stderr).not.toContain(ignoredId);
    expect(result.stderr).toContain(detectedId);
  });
});
