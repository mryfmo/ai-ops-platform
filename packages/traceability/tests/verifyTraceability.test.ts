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

interface FixtureOptions {
  prjopsReqs?: string[];
  devopsReqs?: string[];
  sourceText?: string;
}

function fixture(options: FixtureOptions | string[] = {}): string {
  const normalized: FixtureOptions = Array.isArray(options) ? { prjopsReqs: options } : options;
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
    JSON.stringify({ system: "PrjOps", REQ: normalized.prjopsReqs ?? [] }),
  );
  writeFileSync(
    join(root, "packages/traceability/spec-ids/devops.json"),
    JSON.stringify({ system: "DevOps", REQ: normalized.devopsReqs ?? [] }),
  );
  if (normalized.sourceText !== undefined) {
    writeFileSync(join(root, "packages/shared/src/references.ts"), normalized.sourceText);
  }
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

describe("canonical traceability namespace [PrjOps:AC-043-1 / DevOps:AC-033a]", () => {
  it("rejects one bare colliding ID as evidence for both systems [PrjOps:AC-043-1 / DevOps:AC-033a]", async () => {
    const root = fixture({
      prjopsReqs: ["REQ-001"],
      devopsReqs: ["REQ-001"],
      sourceText: "/** 根拠: REQ-001 */\nexport {};\n",
    });

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("REQ-001");
    expect(result.stderr).toContain("packages/shared/src/references.ts");
  });

  it("does not let a DevOps reference satisfy the PrjOps catalog [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const root = fixture({
      prjopsReqs: ["REQ-001"],
      devopsReqs: ["REQ-001"],
      sourceText: "/** 根拠: DevOps:REQ-001 */\nexport {};\n",
    });

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("PrjOps:REQ-001");
  });

  it("rejects a malformed namespace instead of accepting its bare suffix [PrjOps:SPEC-INT-070]", async () => {
    const root = fixture({
      prjopsReqs: ["REQ-001"],
      sourceText: "/** 根拠: PrjOps :REQ-001 */\nexport {};\n",
    });

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("PrjOps :REQ-001");
    expect(result.stderr).toContain("packages/shared/src/references.ts");
  });

  it("accepts explicit references to the same ID in both systems [PrjOps:AC-043-1 / DevOps:AC-033a]", async () => {
    const root = fixture({
      prjopsReqs: ["REQ-001"],
      devopsReqs: ["REQ-001"],
      sourceText: "/** 根拠: PrjOps:REQ-001 / DevOps:REQ-001 */\nexport {};\n",
    });

    const result = await runFailure(root);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("rejects a canonical reference absent from its system catalog [PrjOps:SPEC-INT-070]", async () => {
    const root = fixture({
      sourceText: "/** 根拠: PrjOps:REQ-999 */\nexport {};\n",
    });

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("PrjOps:REQ-999");
  });

  it("rejects an unknown namespace without treating its suffix as bare evidence [PrjOps:SPEC-INT-070]", async () => {
    const root = fixture({
      prjopsReqs: ["REQ-001"],
      sourceText: "/** 根拠: Other:REQ-001 */\nexport {};\n",
    });

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Other:REQ-001");
  });

  it("does not match a longer identifier by prefix [PrjOps:SPEC-INT-070]", async () => {
    const root = fixture({
      prjopsReqs: ["REQ-001"],
      sourceText: "/** 根拠: PrjOps:REQ-0010 */\nexport {};\n",
    });

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("malformed canonical reference: PrjOps:REQ-0010");
  });

  it("keeps a non-colliding bare reference valid during migration [PrjOps:SPEC-INT-070]", async () => {
    const root = fixture({
      prjopsReqs: ["REQ-001"],
      sourceText: "/** 根拠: REQ-001 */\nexport {};\n",
    });

    const result = await runFailure(root);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
  });

  it.each([
    "PrjOps::REQ-001",
    "PrjOps:::REQ-001",
    "PrjOps:::::REQ-001",
    "PrjOps/REQ-001",
    "PrjOps/////REQ-001",
    "PrjOps     REQ-001",
  ])("rejects non-canonical known-system separators in %s [PrjOps:SPEC-INT-070]", async (reference) => {
    const root = fixture({
      prjopsReqs: ["REQ-001"],
      sourceText: `/** 根拠: ${reference} */\nexport {};\n`,
    });

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(reference);
  });

  it.each(["PrjOps:REQ-001_suffix", "_REQ-001"])(
    "does not count an underscore-affixed token in %s [PrjOps:SPEC-INT-070]",
    async (reference) => {
      const root = fixture({
        prjopsReqs: ["REQ-001"],
        sourceText: `/** 根拠: ${reference} */\nexport {};\n`,
      });

      const result = await runFailure(root);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain("PrjOps:REQ-001");
    },
  );

  it("treats a unique ID after a YAML key as bare migration evidence [PrjOps:SPEC-INT-070]", async () => {
    const root = fixture({
      prjopsReqs: ["REQ-001"],
      sourceText: "const metadata = `basis: REQ-001`;\n",
    });

    const result = await runFailure(root);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("reports a canonical-looking invalid ID even with an empty catalog [PrjOps:SPEC-INT-070]", async () => {
    const root = fixture({
      sourceText: "/** 根拠: PrjOps:REQ-ABC */\nexport {};\n",
    });

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("malformed canonical reference: PrjOps:REQ-ABC");
    expect(result.stderr).toContain("packages/shared/src/references.ts");
  });

  it("ignores ordinary colon-delimited code tokens [PrjOps:SPEC-INT-070]", async () => {
    const root = fixture({
      sourceText: 'import { join } from "node:path";\nconst css = "margin:0";\nconst time = "HH:mm";\n',
    });

    const result = await runFailure(root);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("does not treat unrelated syntax after a system-named variable as a namespace [PrjOps:SPEC-INT-070]", async () => {
    const root = fixture({
      prjopsReqs: ["REQ-001"],
      sourceText: "const PrjOps = {}; // REQ-001\n",
    });

    const result = await runFailure(root);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("rejects repeated colons after an unknown system [PrjOps:SPEC-INT-070]", async () => {
    const root = fixture({
      prjopsReqs: ["REQ-001"],
      sourceText: "/** 根拠: Other::REQ-001 */\nexport {};\n",
    });

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("unknown traceability system: Other::REQ-001");
  });
});
