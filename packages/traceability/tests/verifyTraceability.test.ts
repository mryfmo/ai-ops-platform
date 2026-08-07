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
import { runTraceability, runTraceabilityCli } from "../src/verifyTraceability.js";

const fixtures: string[] = [];
const missingAdr = (number: number): string => `ADR-${number}`;

interface FixtureOptions {
  prjopsReqs?: string[];
  prjopsSpecInts?: string[];
  devopsReqs?: string[];
  prjopsSystem?: string;
  devopsSystem?: string;
  catalogText?: string;
  sourceText?: string;
  traceabilitySourceText?: string;
  traceabilityTestText?: string;
  traceabilityOtherTestText?: string;
  prjopsDispositions?: unknown[];
  serverConfigText?: string;
  webConfigText?: string;
  configDocText?: string;
  envExampleText?: string;
  omitConfigDoc?: boolean;
}

/**
 * 設定変数ガード用の最小 fixture。既定の 4 ファイルは互いに一致しており、
 * どれか 1 つだけを差し替えれば乖離を作れる。
 */
const FIXTURE_SERVER_CONFIG = [
  "/** 根拠: ADR-0004 */",
  "const baseConfigSchema = z.object({",
  "  DATABASE_URL: z.string(),",
  "  PORT: z.coerce.number(),",
  "});",
  "const configSchema = baseConfigSchema;",
  "",
].join("\n");

const FIXTURE_WEB_CONFIG = [
  "/** 根拠: ADR-0004 */",
  "const webConfigSchema = z",
  "  .object({",
  "    AUTH_SECRET: z.string(),",
  "  })",
  "  .superRefine(() => undefined);",
  "",
].join("\n");

function fixtureConfigDoc(serverRows: string[], webRows: string[]): string {
  const table = (rows: string[]) => ["| Variable | Required |", "| --- | --- |", ...rows].join("\n");
  return [
    "# Configuration Reference",
    "",
    "## Server",
    "",
    table(serverRows),
    "",
    "## Web",
    "",
    table(webRows),
    "",
    "## Report Generation",
    "",
  ].join("\n");
}

const FIXTURE_CONFIG_DOC = fixtureConfigDoc(
  ["| `DATABASE_URL` | Yes |", "| `PORT` | No |"],
  ["| `AUTH_SECRET` | Yes |"],
);

const FIXTURE_ENV_EXAMPLE = ["DATABASE_URL=", "PORT=8080", "AUTH_SECRET=", ""].join("\n");

function fixtureCatalog(prjopsReqs: string[], devopsReqs: string[]): string {
  const section = (system: string, ids: string[]) =>
    [
      `## ${system}`,
      "",
      "### REQ",
      "",
      "| ID | Definition | Canonical source | Representative implementation/tests |",
      "| --- | --- | --- | --- |",
      ...ids.map(
        (id) => `| \`${system}:${id}\` | Fixture definition for ${id}. | [ADR-0004](../adr/0004-toolchain.md) | — |`,
      ),
    ].join("\n");
  return ["# Spec ID Catalog", "", section("PrjOps", prjopsReqs), "", section("DevOps", devopsReqs), ""].join("\n");
}

function fixture(options: FixtureOptions | string[] = {}): string {
  const normalized: FixtureOptions = Array.isArray(options) ? { prjopsReqs: options } : options;
  const root = mkdtempSync(join(tmpdir(), "aiops-traceability-"));
  fixtures.push(root);
  for (const dir of [
    "packages/traceability/spec-ids",
    "packages/traceability/output",
    "packages/traceability/src",
    "packages/traceability/tests",
    "packages/shared/src",
    "packages/prjops/src",
    "packages/devops/src",
    "packages/server/src",
    "packages/web/src",
    "packages/web/src/server",
    "docs/adr",
    "docs/spec",
    "docs/reference",
  ]) {
    mkdirSync(join(root, dir), { recursive: true });
  }
  writeFileSync(
    join(root, "packages/traceability/spec-ids/prjops.json"),
    JSON.stringify({
      system: normalized.prjopsSystem ?? "PrjOps",
      REQ: normalized.prjopsReqs ?? [],
      "SPEC-INT": normalized.prjopsSpecInts ?? [],
      dispositions: normalized.prjopsDispositions,
    }),
  );
  writeFileSync(
    join(root, "packages/traceability/spec-ids/devops.json"),
    JSON.stringify({ system: normalized.devopsSystem ?? "DevOps", REQ: normalized.devopsReqs ?? [] }),
  );
  // 名前空間ガード用のsrc fixtureは根拠ヘッダガードの対象でもある（走査範囲を全パッケージ
  // src/へ広げたため）。当該テストの主題ではないので、ヘッダを持たない指定にだけ補う。
  // 根拠ヘッダガード自体は専用のdescribeで検証する。
  const withBasisHeader = (text: string) => (text.includes("根拠:") ? text : `/** 根拠: ADR-0004 */\n${text}`);
  if (normalized.sourceText !== undefined) {
    writeFileSync(join(root, "packages/shared/src/references.ts"), withBasisHeader(normalized.sourceText));
  }
  if (normalized.traceabilitySourceText !== undefined) {
    writeFileSync(
      join(root, "packages/traceability/src/references.ts"),
      withBasisHeader(normalized.traceabilitySourceText),
    );
  }
  if (normalized.traceabilityTestText !== undefined) {
    writeFileSync(
      join(root, "packages/traceability/tests/verifyTraceability.test.ts"),
      normalized.traceabilityTestText,
    );
  }
  if (normalized.traceabilityOtherTestText !== undefined) {
    writeFileSync(join(root, "packages/traceability/tests/other.test.ts"), normalized.traceabilityOtherTestText);
  }
  writeFileSync(join(root, "packages/server/src/config.ts"), normalized.serverConfigText ?? FIXTURE_SERVER_CONFIG);
  writeFileSync(join(root, "packages/web/src/server/config.ts"), normalized.webConfigText ?? FIXTURE_WEB_CONFIG);
  writeFileSync(join(root, ".env.example"), normalized.envExampleText ?? FIXTURE_ENV_EXAMPLE);
  if (!normalized.omitConfigDoc) {
    writeFileSync(join(root, "docs/reference/configuration.md"), normalized.configDocText ?? FIXTURE_CONFIG_DOC);
  }
  writeFileSync(join(root, "docs/adr/0004-toolchain.md"), "# ADR-0004\n");
  writeFileSync(
    join(root, "docs/spec/spec-id-catalog.md"),
    normalized.catalogText ?? fixtureCatalog(normalized.prjopsReqs ?? [], normalized.devopsReqs ?? []),
  );
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

describe("spec ID index guard [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", () => {
  it("rejects a duplicate ID in an index category [PrjOps:AC-043-1]", async () => {
    const result = await runFailure(
      fixture({
        prjopsReqs: ["REQ-001", "REQ-001"],
        sourceText: "/** 根拠: PrjOps:REQ-001 */\nexport {};\n",
        catalogText: fixtureCatalog(["REQ-001"], []),
      }),
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("duplicate spec index ID: PrjOps:REQ-001 under REQ/REQ");
  });

  it("rejects an ID stored under a mismatched index category [PrjOps:AC-043-1]", async () => {
    const result = await runFailure(
      fixture({
        prjopsSpecInts: ["REQ-001"],
        sourceText: "/** 根拠: PrjOps:REQ-001 */\nexport {};\n",
        catalogText: fixtureCatalog(["REQ-001"], []),
      }),
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("spec index category mismatch: PrjOps:REQ-001 under SPEC-INT");
  });

  it("rejects duplicate system names across index files [DevOps:AC-033a]", async () => {
    const result = await runFailure(fixture({ devopsSystem: "PrjOps" }));

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("duplicate spec index system: PrjOps");
  });

  it("rejects an unknown index system [PrjOps:AC-043-1]", async () => {
    const result = await runFailure(fixture({ prjopsSystem: "Other" }));

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("invalid spec index system: Other");
  });
});

describe("spec ID catalog guard [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", () => {
  it("rejects an indexed ID missing from the catalog [PrjOps:AC-043-1]", async () => {
    const result = await runFailure(
      fixture({
        prjopsReqs: ["REQ-001"],
        sourceText: "/** 根拠: PrjOps:REQ-001 */\nexport {};\n",
        catalogText: fixtureCatalog([], []),
      }),
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("catalog ID missing: PrjOps:REQ-001");
  });

  it("rejects a duplicate catalog row [PrjOps:AC-043-1]", async () => {
    const row = "| `PrjOps:REQ-001` | Fixture definition for REQ-001. | [ADR-0004](../adr/0004-toolchain.md) | — |";
    const result = await runFailure(
      fixture({
        prjopsReqs: ["REQ-001"],
        sourceText: "/** 根拠: PrjOps:REQ-001 */\nexport {};\n",
        catalogText: fixtureCatalog(["REQ-001"], []).replace(row, `${row}\n${row}`),
      }),
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("duplicate catalog ID: PrjOps:REQ-001");
  });

  it("rejects an ID cataloged under the wrong system [PrjOps:AC-043-1 / DevOps:AC-033a]", async () => {
    const result = await runFailure(
      fixture({
        prjopsReqs: ["REQ-001"],
        sourceText: "/** 根拠: PrjOps:REQ-001 */\nexport {};\n",
        catalogText: fixtureCatalog([], ["REQ-001"]).replace("DevOps:REQ-001", "PrjOps:REQ-001"),
      }),
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("wrong catalog system: PrjOps:REQ-001 under DevOps");
  });

  it("rejects a catalog row absent from the system index [DevOps:AC-033a]", async () => {
    const result = await runFailure(
      fixture({
        devopsReqs: ["REQ-002"],
        sourceText: "/** 根拠: DevOps:REQ-002 */\nexport {};\n",
        catalogText: fixtureCatalog([], ["REQ-002", "REQ-999"]),
      }),
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("unknown catalog ID: DevOps:REQ-999");
  });

  it("rejects an empty definition and a missing canonical source [DevOps:AC-033a]", async () => {
    const result = await runFailure(
      fixture({
        devopsReqs: ["REQ-002"],
        sourceText: "/** 根拠: DevOps:REQ-002 */\nexport {};\n",
        catalogText: fixtureCatalog([], ["REQ-002"]).replace(
          "| `DevOps:REQ-002` | Fixture definition for REQ-002. | [ADR-0004](../adr/0004-toolchain.md) | — |",
          "| `DevOps:REQ-002` | — | [Missing](missing.md) | — |",
        ),
      }),
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("catalog definition missing: DevOps:REQ-002");
    expect(result.stderr).toContain("catalog source missing: DevOps:REQ-002");
  });

  it("rejects a category that disagrees with the ID prefix [PrjOps:AC-043-1]", async () => {
    const result = await runFailure(
      fixture({
        prjopsReqs: ["REQ-001"],
        sourceText: "/** 根拠: PrjOps:REQ-001 */\nexport {};\n",
        catalogText: fixtureCatalog(["REQ-001"], []).replace("### REQ", "### AC"),
      }),
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("catalog category mismatch: PrjOps:REQ-001 under AC");
  });

  it("rejects a definition that contains only a link [PrjOps:AC-043-1]", async () => {
    const result = await runFailure(
      fixture({
        prjopsReqs: ["REQ-001"],
        sourceText: "/** 根拠: PrjOps:REQ-001 */\nexport {};\n",
        catalogText: fixtureCatalog(["REQ-001"], []).replace(
          "Fixture definition for REQ-001.",
          "[ADR-0004](../adr/0004-toolchain.md)",
        ),
      }),
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("catalog definition is only a link: PrjOps:REQ-001");
  });

  it("rejects a canonical source outside the repository [PrjOps:AC-043-1]", async () => {
    const result = await runFailure(
      fixture({
        prjopsReqs: ["REQ-001"],
        sourceText: "/** 根拠: PrjOps:REQ-001 */\nexport {};\n",
        catalogText: fixtureCatalog(["REQ-001"], []).replace(
          "[ADR-0004](../adr/0004-toolchain.md)",
          "[outside](/etc/hosts)",
        ),
      }),
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("catalog source outside repository: PrjOps:REQ-001");
  });

  it("rejects a source fragment that does not exist [DevOps:AC-033a]", async () => {
    const result = await runFailure(
      fixture({
        devopsReqs: ["REQ-002"],
        sourceText: "/** 根拠: DevOps:REQ-002 */\nexport {};\n",
        catalogText: fixtureCatalog([], ["REQ-002"]).replace(
          "../adr/0004-toolchain.md",
          "../adr/0004-toolchain.md#L999",
        ),
      }),
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("catalog source fragment missing: DevOps:REQ-002");
  });

  it("rejects one broken source even when another source exists [DevOps:AC-033a]", async () => {
    const result = await runFailure(
      fixture({
        devopsReqs: ["REQ-002"],
        sourceText: "/** 根拠: DevOps:REQ-002 */\nexport {};\n",
        catalogText: fixtureCatalog([], ["REQ-002"]).replace(
          "[ADR-0004](../adr/0004-toolchain.md)",
          "[ADR-0004](../adr/0004-toolchain.md), [Missing](missing.md)",
        ),
      }),
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("catalog source missing: DevOps:REQ-002");
  });

  it("rejects a row with an unencoded table separator [PrjOps:AC-043-1]", async () => {
    const result = await runFailure(
      fixture({
        prjopsReqs: ["REQ-001"],
        sourceText: "/** 根拠: PrjOps:REQ-001 */\nexport {};\n",
        catalogText: fixtureCatalog(["REQ-001"], []).replace(
          "Fixture definition for REQ-001.",
          "Fixture | definition for REQ-001.",
        ),
      }),
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("malformed catalog row: PrjOps:REQ-001");
  });

  it("resets category context at an unknown level-three heading [PrjOps:AC-043-1]", async () => {
    const result = await runFailure(
      fixture({
        prjopsReqs: ["REQ-001"],
        sourceText: "/** 根拠: PrjOps:REQ-001 */\nexport {};\n",
        catalogText: fixtureCatalog(["REQ-001"], []).replace("### REQ\n", "### REQ\n\n### Notes\n"),
      }),
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("catalog category mismatch: PrjOps:REQ-001 under unclassified");
  });

  it("rejects a mirror source span that defines another ID [PrjOps:AC-043-1]", async () => {
    const root = fixture({
      prjopsReqs: ["REQ-001"],
      sourceText: "/** 根拠: PrjOps:REQ-001 */\nexport {};\n",
      catalogText: fixtureCatalog(["REQ-001"], []).replace("../adr/0004-toolchain.md", "prjops/03_PRD.md#L1"),
    });
    mkdirSync(join(root, "docs/spec/prjops"), { recursive: true });
    writeFileSync(join(root, "docs/spec/prjops/03_PRD.md"), "REQ-999 another requirement\n");

    const result = await runFailure(root);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("catalog source does not define: PrjOps:REQ-001");
  });

  it("rejects a mirror source document that disagrees with the ID category [PrjOps:AC-043-1]", async () => {
    const root = fixture({
      prjopsReqs: ["REQ-001"],
      sourceText: "/** 根拠: PrjOps:REQ-001 */\nexport {};\n",
      catalogText: fixtureCatalog(["REQ-001"], []).replace("../adr/0004-toolchain.md", "prjops/04_外部仕様書.md#L1"),
    });
    mkdirSync(join(root, "docs/spec/prjops"), { recursive: true });
    writeFileSync(join(root, "docs/spec/prjops/04_外部仕様書.md"), "REQ-001 wrong document\n");

    const result = await runFailure(root);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("catalog source document mismatch: PrjOps:REQ-001");
  });

  it("normalizes a relative mirror path before enforcing its source rules [PrjOps:AC-043-1]", async () => {
    const root = fixture({
      prjopsReqs: ["REQ-001"],
      sourceText: "/** 根拠: PrjOps:REQ-001 */\nexport {};\n",
      catalogText: fixtureCatalog(["REQ-001"], []).replace("../adr/0004-toolchain.md", "./prjops/03_PRD.md"),
    });
    mkdirSync(join(root, "docs/spec/prjops"), { recursive: true });
    writeFileSync(join(root, "docs/spec/prjops/03_PRD.md"), "**REQ-001 definition**\n");

    const result = await runFailure(root);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("catalog source fragment missing: PrjOps:REQ-001");
  });

  it("rejects a source span that only mentions the target ID [PrjOps:AC-043-1]", async () => {
    const root = fixture({
      prjopsReqs: ["REQ-001"],
      sourceText: "/** 根拠: PrjOps:REQ-001 */\nexport {};\n",
      catalogText: fixtureCatalog(["REQ-001"], []).replace("../adr/0004-toolchain.md", "prjops/03_PRD.md#L1"),
    });
    mkdirSync(join(root, "docs/spec/prjops"), { recursive: true });
    writeFileSync(join(root, "docs/spec/prjops/03_PRD.md"), "REQ-999 definition merely references REQ-001\n");

    const result = await runFailure(root);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("catalog source does not define: PrjOps:REQ-001");
  });

  it.each([
    ["heading", "### REQ-999 definition merely references REQ-001\n"],
    ["table row", "| REQ-999 | definition merely references REQ-001 |\n"],
  ])("rejects a %s whose primary definition is another ID [PrjOps:AC-043-1]", async (_kind, canonicalText) => {
    const root = fixture({
      prjopsReqs: ["REQ-001"],
      sourceText: "/** 根拠: PrjOps:REQ-001 */\nexport {};\n",
      catalogText: fixtureCatalog(["REQ-001"], []).replace("../adr/0004-toolchain.md", "prjops/03_PRD.md#L1"),
    });
    mkdirSync(join(root, "docs/spec/prjops"), { recursive: true });
    writeFileSync(join(root, "docs/spec/prjops/03_PRD.md"), canonicalText);

    const result = await runFailure(root);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("catalog source does not define: PrjOps:REQ-001");
  });
});

describe("implementation dispositions [PrjOps:SPEC-INT-070]", () => {
  it("renders partial scope and remaining obligations without treating a source reference as completion", async () => {
    const root = fixture({
      prjopsReqs: ["REQ-001"],
      sourceText: "/** 根拠: PrjOps:REQ-001 */\nexport {};\n",
      prjopsDispositions: [
        {
          id: "REQ-001",
          status: "partial",
          completed: ["deterministic renderer"],
          remaining: ["production scheduler"],
          basis: ["docs/adr/0004-toolchain.md"],
          owner: "TASK-001",
        },
      ],
    });

    const result = await runTraceability({ repoRoot: root, writeOutput: false });

    expect(result.exitCode).toBe(0);
    expect(result.report).toContain("Implementation Dispositions");
    expect(result.report).toContain("PrjOps:REQ-001");
    expect(result.report).toContain("partial");
    expect(result.report).toContain("production scheduler");
  });

  it("rejects a disposition for an ID outside the catalog", async () => {
    const result = await runFailure(
      fixture({
        prjopsDispositions: [
          {
            id: "REQ-999",
            status: "partial",
            completed: ["x"],
            remaining: ["y"],
            basis: ["docs/adr/0004-toolchain.md"],
            owner: "TASK-001",
          },
        ],
      }),
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("unknown disposition ID: PrjOps:REQ-999");
  });

  it("renders superseded specifications with their replacement and retained obligations", async () => {
    const root = fixture({
      prjopsReqs: ["REQ-001"],
      sourceText: "/** 根拠: PrjOps:REQ-001 */\nexport {};\n",
      prjopsDispositions: [
        {
          id: "REQ-001",
          status: "superseded",
          completed: ["replacement boundary"],
          superseded_by: ["ADR-0004"],
          retained_obligations: ["external environment evidence"],
          basis: ["docs/adr/0004-toolchain.md"],
          owner: "TASK-002",
        },
      ],
    });

    const result = await runTraceability({ repoRoot: root, writeOutput: false });

    expect(result.exitCode).toBe(0);
    expect(result.report).toContain("superseded");
    expect(result.report).toContain("ADR-0004");
    expect(result.report).toContain("external environment evidence");
    expect(result.report).not.toContain("実装参照あり");
  });

  it("rejects a disposition whose evidence path is missing", async () => {
    const result = await runFailure(
      fixture({
        prjopsReqs: ["REQ-001"],
        sourceText: "/** 根拠: PrjOps:REQ-001 */\nexport {};\n",
        prjopsDispositions: [
          {
            id: "REQ-001",
            status: "superseded",
            completed: ["replacement selected"],
            superseded_by: ["ADR-0004"],
            retained_obligations: ["external repository"],
            basis: ["docs/adr/missing.md"],
            owner: "TASK-001",
          },
        ],
      }),
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("disposition basis missing: docs/adr/missing.md");
  });

  it.each([
    [
      "duplicate ID",
      [
        {
          id: "REQ-001",
          status: "partial",
          completed: ["x"],
          remaining: ["y"],
          basis: ["docs/adr/0004-toolchain.md"],
          owner: "TASK-001",
        },
        {
          id: "REQ-001",
          status: "partial",
          completed: ["x"],
          remaining: ["y"],
          basis: ["docs/adr/0004-toolchain.md"],
          owner: "TASK-002",
        },
      ],
      "duplicate disposition ID: PrjOps:REQ-001",
    ],
    [
      "invalid status",
      [
        {
          id: "REQ-001",
          status: "implemented",
          completed: ["x"],
          remaining: ["y"],
          basis: ["docs/adr/0004-toolchain.md"],
          owner: "TASK-001",
        },
      ],
      "invalid disposition status: PrjOps:REQ-001",
    ],
    [
      "empty required field",
      [
        {
          id: "REQ-001",
          status: "partial",
          completed: ["x"],
          remaining: [],
          basis: ["docs/adr/0004-toolchain.md"],
          owner: "TASK-001",
        },
      ],
      "invalid disposition remaining: PrjOps:REQ-001",
    ],
  ])("rejects %s", async (_name, dispositions, expected) => {
    const result = await runFailure(
      fixture({
        prjopsReqs: ["REQ-001"],
        sourceText: "/** 根拠: PrjOps:REQ-001 */\nexport {};\n",
        prjopsDispositions: dispositions as unknown[],
      }),
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(expected);
  });
});

describe("canonical traceability namespace [PrjOps:AC-043-1 / DevOps:AC-033a]", () => {
  it("counts canonical implementation references in the traceability package [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const root = fixture({
      prjopsReqs: ["REQ-001"],
      devopsReqs: ["REQ-002"],
      traceabilitySourceText: "/** 根拠: PrjOps:REQ-001 / DevOps:REQ-002 */\nexport {};\n",
    });

    const result = await runFailure(root);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("does not report intentional invalid-reference fixtures as repository violations [PrjOps:SPEC-INT-070]", async () => {
    const root = fixture({
      traceabilityTestText: "/** 根拠: Other:REQ-001 */\nexport {};\n",
    });

    const result = await runFailure(root);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("still validates namespace references in other traceability tests [PrjOps:SPEC-INT-070]", async () => {
    const root = fixture({
      traceabilityOtherTestText: "/** 根拠: Other:REQ-001 */\nexport {};\n",
    });

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("unknown traceability system: Other:REQ-001");
    expect(result.stderr).toContain("packages/traceability/tests/other.test.ts");
  });

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

describe("設定変数インベントリガード [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084 / ADR-0005]", () => {
  it("一致している 4 ファイルは通す [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const result = await runFailure(fixture({}));

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("server スキーマにあって configuration.md の server 表に無い変数を失敗にする [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const root = fixture({
      configDocText: fixtureConfigDoc(["| `DATABASE_URL` | Yes |"], ["| `AUTH_SECRET` | Yes |"]),
    });

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("config inventory: PORT is in the server Zod schema");
  });

  it("web スキーマにあって configuration.md の web 表に無い変数を失敗にする [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const root = fixture({
      configDocText: fixtureConfigDoc(["| `DATABASE_URL` | Yes |", "| `PORT` | No |"], []),
    });

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("config inventory: AUTH_SECRET is in the web Zod schema");
  });

  it("スキーマにあって .env.example に無い変数を失敗にする [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const root = fixture({ envExampleText: "DATABASE_URL=\nAUTH_SECRET=\n" });

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("config inventory: PORT is in the Zod schemas but not in .env.example");
  });

  it("どちらのスキーマにも無い変数が文書に載っていれば失敗にする [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const root = fixture({
      configDocText: fixtureConfigDoc(
        ["| `DATABASE_URL` | Yes |", "| `PORT` | No |", "| `RETIRED_FLAG` | No |"],
        ["| `AUTH_SECRET` | Yes |"],
      ),
    });

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(
      "config inventory: RETIRED_FLAG is in the configuration.md server table but not in the server Zod schema",
    );
  });

  it("configuration.md が消えたら失敗にする [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const result = await runFailure(fixture({ omitConfigDoc: true }));

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("config inventory source missing: docs/reference/configuration.md");
  });

  it("スキーマ本体を読めなくなったら空集合一致で黙って通さない [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const root = fixture({ serverConfigText: "/** 根拠: ADR-0004 */\nexport const renamed = 1;\n" });

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Zod schema body not found");
  });
});

describe("設定変数ガードの報告掲載 [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", () => {
  it("失敗した実行の matrix が全ガード clean に見えないようにする [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const root = fixture({ envExampleText: "DATABASE_URL=\nAUTH_SECRET=\n" });

    const result = await runTraceability({ repoRoot: root, writeOutput: false });

    expect(result.exitCode).toBe(1);
    expect(result.report).toContain("設定変数インベントリ不整合");
    expect(result.report).toContain("PORT is in the Zod schemas but not in .env.example");
  });

  it("一致していれば報告欄は空表示になる [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const result = await runTraceability({ repoRoot: fixture({}), writeOutput: false });

    expect(result.exitCode).toBe(0);
    expect(result.report).toContain("設定変数インベントリ不整合: —");
  });
});

describe("設定変数の表別突合 [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", () => {
  it("web専用の変数が server 表に載っていれば失敗にする [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    // 合算で突合すると「どちらかのスキーマにあるので OK」と読めてしまい、
    // 表が対応スキーマのインベントリであるという主張が崩れたまま緑になる。
    const root = fixture({
      configDocText: fixtureConfigDoc(
        ["| `DATABASE_URL` | Yes |", "| `PORT` | No |", "| `AUTH_SECRET` | Yes |"],
        ["| `AUTH_SECRET` | Yes |"],
      ),
    });

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(
      "config inventory: AUTH_SECRET is in the configuration.md server table but not in the server Zod schema",
    );
  });

  it("server専用の変数が web 表に載っていれば失敗にする [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const root = fixture({
      configDocText: fixtureConfigDoc(
        ["| `DATABASE_URL` | Yes |", "| `PORT` | No |"],
        ["| `AUTH_SECRET` | Yes |", "| `PORT` | No |"],
      ),
    });

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(
      "config inventory: PORT is in the configuration.md web table but not in the web Zod schema",
    );
  });

  it("どちらのスキーマにも無い変数が .env.example にあれば失敗にする [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const root = fixture({ envExampleText: "DATABASE_URL=\nPORT=8080\nAUTH_SECRET=\nRETIRED_FLAG=1\n" });

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("config inventory: RETIRED_FLAG is in .env.example but is in neither Zod schema");
  });
});

describe("設定変数の短い名前 [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", () => {
  it("2文字の変数もインベントリ対象にする [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    // TZ のような短い環境変数名を抽出から落とすと、他のキーが残っているため
    // 空スキーマ判定にも掛からず、key-for-key の保証が静かに破れる。
    const root = fixture({
      serverConfigText: [
        "/** 根拠: ADR-0004 */",
        "const baseConfigSchema = z.object({",
        "  DATABASE_URL: z.string(),",
        "  PORT: z.coerce.number(),",
        "  TZ: z.string(),",
        "});",
        "const configSchema = baseConfigSchema;",
        "",
      ].join("\n"),
    });

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("config inventory: TZ is in the server Zod schema");
  });

  it("短い変数も表と .env.example に揃っていれば通す [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const root = fixture({
      serverConfigText: [
        "/** 根拠: ADR-0004 */",
        "const baseConfigSchema = z.object({",
        "  DATABASE_URL: z.string(),",
        "  PORT: z.coerce.number(),",
        "  TZ: z.string(),",
        "});",
        "const configSchema = baseConfigSchema;",
        "",
      ].join("\n"),
      configDocText: fixtureConfigDoc(
        ["| `DATABASE_URL` | Yes |", "| `PORT` | No |", "| `TZ` | No |"],
        ["| `AUTH_SECRET` | Yes |"],
      ),
      envExampleText: ["DATABASE_URL=", "PORT=8080", "TZ=Asia/Tokyo", "AUTH_SECRET=", ""].join("\n"),
    });

    const result = await runFailure(root);

    expect(result.stderr).toBe("");
    expect(result.code).toBe(0);
  });
});

describe("設定変数のアンダースコア始まり [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", () => {
  const withUnderscoreKey = [
    "/** 根拠: ADR-0004 */",
    "const baseConfigSchema = z.object({",
    "  DATABASE_URL: z.string(),",
    "  PORT: z.coerce.number(),",
    "  _JAVA_OPTIONS: z.string(),",
    "});",
    "const configSchema = baseConfigSchema;",
    "",
  ].join("\n");

  it("_始まりの変数もインベントリ対象にする [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const result = await runFailure(fixture({ serverConfigText: withUnderscoreKey }));

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("config inventory: _JAVA_OPTIONS is in the server Zod schema");
  });

  it("_始まりも表と .env.example に揃っていれば通す [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const root = fixture({
      serverConfigText: withUnderscoreKey,
      configDocText: fixtureConfigDoc(
        ["| `DATABASE_URL` | Yes |", "| `PORT` | No |", "| `_JAVA_OPTIONS` | No |"],
        ["| `AUTH_SECRET` | Yes |"],
      ),
      envExampleText: ["DATABASE_URL=", "PORT=8080", "_JAVA_OPTIONS=-Xmx1g", "AUTH_SECRET=", ""].join("\n"),
    });

    const result = await runFailure(root);

    expect(result.stderr).toBe("");
    expect(result.code).toBe(0);
  });
});

describe("設定変数の名前の形に依存しない抽出 [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", () => {
  // 大文字限定・3文字以上・`_`始まり不可、と個別に穴が見つかったため、
  // 識別子として妥当な形すべてを受けることを固定する。
  const shapes = ["TZ", "_JAVA_OPTIONS", "http_proxy", "MixedCase"] as const;

  for (const key of shapes) {
    it(`${key} をスキーマだけに足すと失敗する [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]`, async () => {
      const root = fixture({
        serverConfigText: [
          "/** 根拠: ADR-0004 */",
          "const baseConfigSchema = z.object({",
          "  DATABASE_URL: z.string(),",
          "  PORT: z.coerce.number(),",
          `  ${key}: z.string(),`,
          "});",
          "const configSchema = baseConfigSchema;",
          "",
        ].join("\n"),
      });

      const result = await runFailure(root);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain(`config inventory: ${key} is in the server Zod schema`);
    });
  }

  it("クォート付きのキーも抽出する [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const root = fixture({
      serverConfigText: [
        "/** 根拠: ADR-0004 */",
        "const baseConfigSchema = z.object({",
        "  DATABASE_URL: z.string(),",
        "  PORT: z.coerce.number(),",
        '  "QUOTED_KEY": z.string(),',
        "});",
        "const configSchema = baseConfigSchema;",
        "",
      ].join("\n"),
    });

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("config inventory: QUOTED_KEY is in the server Zod schema");
  });
});

describe("設定変数の shorthand プロパティ [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", () => {
  it("shorthandで定義されたキーも抽出する [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const root = fixture({
      serverConfigText: [
        "/** 根拠: ADR-0004 */",
        "const NEW_FLAG = z.string();",
        "const baseConfigSchema = z.object({",
        "  DATABASE_URL: z.string(),",
        "  PORT: z.coerce.number(),",
        "  NEW_FLAG,",
        "});",
        "const configSchema = baseConfigSchema;",
        "",
      ].join("\n"),
    });

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("config inventory: NEW_FLAG is in the server Zod schema");
  });

  it("複数行呼び出しの引数をキーと誤認しない [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    // shorthand と同じ「識別子＋カンマだけの行」でも、括弧の内側なら引数であってキーではない。
    const root = fixture({
      serverConfigText: [
        "/** 根拠: ADR-0004 */",
        "const baseConfigSchema = z.object({",
        "  DATABASE_URL: z.string(),",
        "  PORT: z.coerce.number().refine(",
        "    isPositive,",
        "    message,",
        "  ),",
        "});",
        "const configSchema = baseConfigSchema;",
        "",
      ].join("\n"),
    });

    const result = await runFailure(root);

    expect(result.stderr).not.toContain("isPositive");
    expect(result.stderr).not.toContain("message");
    expect(result.code).toBe(0);
  });
});

describe("設定変数の合成スキーマ [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", () => {
  it("読めない合成形（.extend）を黙って読み飛ばさず失敗にする [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const root = fixture({
      serverConfigText: [
        "/** 根拠: ADR-0004 */",
        "const baseConfigSchema = z.object({",
        "  DATABASE_URL: z.string(),",
        "  PORT: z.coerce.number(),",
        "});",
        "const configSchema = baseConfigSchema.extend({ NEW_FLAG: z.string() });",
        "",
      ].join("\n"),
    });

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("cannot follow composed schemas");
    expect(result.stderr).toContain(".extend(");
  });

  it("web側の合成も検出する [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const root = fixture({
      webConfigText: [
        "/** 根拠: ADR-0004 */",
        "const webConfigSchema = z",
        "  .object({",
        "    AUTH_SECRET: z.string(),",
        "  })",
        "  .merge(extraSchema)",
        "  .superRefine(() => undefined);",
        "",
      ].join("\n"),
    });

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("packages/web/src/server/config.ts");
  });

  it("合成が無ければ通常どおり突合する [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const result = await runFailure(fixture({}));

    expect(result.stderr).toBe("");
    expect(result.code).toBe(0);
  });
});

describe("設定変数抽出の字句的な頑健性 [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", () => {
  it("文字列リテラル中の括弧に影響されずshorthandを拾う [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    // 括弧の数を数える方式だと `z.literal("(")` 一つで深さが狂う。判別はインデントで行う。
    const root = fixture({
      serverConfigText: [
        "/** 根拠: ADR-0004 */",
        "const baseConfigSchema = z.object({",
        "  DATABASE_URL: z.string(),",
        '  LABEL: z.literal("("),',
        "  PORT: z.coerce.number(),",
        "  NEW_FLAG,",
        "});",
        "const configSchema = baseConfigSchema;",
        "",
      ].join("\n"),
    });

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("config inventory: NEW_FLAG is in the server Zod schema");
    expect(result.stderr).toContain("config inventory: LABEL is in the server Zod schema");
  });

  it("safeExtend も読めない合成形として失敗にする [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const root = fixture({
      serverConfigText: [
        "/** 根拠: ADR-0004 */",
        "const baseConfigSchema = z.object({",
        "  DATABASE_URL: z.string(),",
        "  PORT: z.coerce.number(),",
        "});",
        "const configSchema = baseConfigSchema.safeExtend({ NEW_FLAG: z.string() });",
        "",
      ].join("\n"),
    });

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(".safeExtend(");
  });
});

describe("設定変数のオブジェクトスプレッド [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", () => {
  it("スプレッドは持ち込まれるキーを解決できないので失敗にする [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const root = fixture({
      serverConfigText: [
        "/** 根拠: ADR-0004 */",
        "const extraShape = { NEW_FLAG: z.string() };",
        "const baseConfigSchema = z.object({",
        "  ...extraShape,",
        "  DATABASE_URL: z.string(),",
        "  PORT: z.coerce.number(),",
        "});",
        "const configSchema = baseConfigSchema;",
        "",
      ].join("\n"),
    });

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("spreads another object into the schema");
  });

  it("web側のスプレッドも検出する [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const root = fixture({
      webConfigText: [
        "/** 根拠: ADR-0004 */",
        "const webConfigSchema = z",
        "  .object({",
        "    ...sharedShape,",
        "    AUTH_SECRET: z.string(),",
        "  })",
        "  .superRefine(() => undefined);",
        "",
      ].join("\n"),
    });

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("packages/web/src/server/config.ts spreads");
  });
});

describe("設定変数の計算プロパティ [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", () => {
  it("計算プロパティは評価結果を解決できないので失敗にする [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const root = fixture({
      serverConfigText: [
        "/** 根拠: ADR-0004 */",
        'const NEW_FLAG = "NEW_FLAG";',
        "const baseConfigSchema = z.object({",
        "  DATABASE_URL: z.string(),",
        "  PORT: z.coerce.number(),",
        "  [NEW_FLAG]: z.string(),",
        "});",
        "const configSchema = baseConfigSchema;",
        "",
      ].join("\n"),
    });

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("uses a computed property key");
  });
});

describe("根拠ヘッダガードの走査範囲 [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", () => {
  const NO_BASIS = "export const x = 1;\n";
  const WITH_BASIS = "/** 根拠: ADR-0004 */\nexport const x = 1;\n";

  // AGENTS.md 設計原則3 は全新規ファイルに根拠ヘッダを要求するが、走査は
  // shared/src/reporting と server/src の 2 箇所だけだった（所見 ADV-VER-005）。
  const scanned = [
    ["packages/prjops/src", "packages/prjops/src/noBasis.ts"],
    ["packages/devops/src", "packages/devops/src/noBasis.ts"],
    ["packages/web/src", "packages/web/src/noBasis.ts"],
    ["packages/traceability/src", "packages/traceability/src/noBasis.ts"],
    ["packages/shared/src", "packages/shared/src/noBasis.ts"],
  ] as const;

  for (const [dir, file] of scanned) {
    it(`${dir} の根拠ヘッダ欠落を検出する [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]`, async () => {
      const root = fixture({});
      mkdirSync(join(root, dir), { recursive: true });
      writeFileSync(join(root, file), NO_BASIS);

      const result = await runFailure(root);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain(`basis header missing: ${file}`);
    });
  }

  it("根拠ヘッダがあれば通す（走査拡大が無条件失敗にならない） [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const root = fixture({});
    for (const [dir, file] of scanned) {
      mkdirSync(join(root, dir), { recursive: true });
      writeFileSync(join(root, file), WITH_BASIS);
    }

    const result = await runFailure(root);

    expect(result.stderr).toBe("");
    expect(result.code).toBe(0);
  });

  it(".tsx も走査対象に含める [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const root = fixture({});
    writeFileSync(join(root, "packages/web/src/page.tsx"), NO_BASIS);

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("basis header missing: packages/web/src/page.tsx");
  });
});

describe("根拠ヘッダが受け付けるIDカテゴリ [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", () => {
  // AGENTS.md 設計原則3 は REQ / SPEC-INT / SPEC-EXT / TH / AC / ADR を列挙する。
  // 従来 SPEC-EXT と TH を受け付けておらず、それらだけを根拠とする正当なファイルが落ちていた。
  const accepted = ["REQ-001", "SPEC-INT-010", "SPEC-EXT-020", "TH-001", "AC-001-1", "ADR-0004"] as const;

  for (const id of accepted) {
    it(`${id} だけを根拠とするファイルを通す [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]`, async () => {
      const root = fixture({});
      writeFileSync(join(root, "packages/devops/src/basis.ts"), `/** 根拠: ${id} */\nexport const x = 1;\n`);

      const result = await runFailure(root);

      expect(result.stderr).not.toContain("basis header missing: packages/devops/src/basis.ts");
    });
  }

  it("語中の TH- を根拠と誤認しない [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const root = fixture({});
    writeFileSync(join(root, "packages/devops/src/basis.ts"), "/** 根拠: MONTH-001 */\nexport const x = 1;\n");

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("basis header missing: packages/devops/src/basis.ts");
  });
});

describe("根拠ヘッダIDの境界と桁数 [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", () => {
  // 桁数だけを緩く見ると `REQ-00000` の先頭4桁が一致し、実在しないIDでガードを通れる。
  // ADR 系は文字列を分割して組み立てる。4桁ゼロの ADR 参照を literal で書くと、
  // ADR参照ガードが対応する docs/adr ファイルの実在を要求して別途落ちる
  // （このファイル冒頭の missingAdr ヘルパーが存在するのと同じ理由）。
  const malformed = ["REQ-00000", "REQ-01", `ADR-${"00000"}`, "SPEC-INT-0001", "XREQ-001"] as const;

  for (const id of malformed) {
    it(`${id} を根拠と認めない [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]`, async () => {
      const root = fixture({});
      writeFileSync(join(root, "packages/devops/src/basis.ts"), `/** 根拠: ${id} */\nexport const x = 1;\n`);

      const result = await runFailure(root);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain("basis header missing: packages/devops/src/basis.ts");
    });
  }

  it("AC の接尾辞形（AC-001-2 / AC-001a）を認める [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const root = fixture({});
    writeFileSync(join(root, "packages/devops/src/a.ts"), "/** 根拠: AC-001-2 */\nexport const x = 1;\n");
    writeFileSync(join(root, "packages/devops/src/b.ts"), "/** 根拠: AC-001a */\nexport const y = 1;\n");

    const result = await runFailure(root);

    expect(result.stderr).not.toContain("basis header missing: packages/devops/src/a.ts");
    expect(result.stderr).not.toContain("basis header missing: packages/devops/src/b.ts");
  });
});

describe("根拠ヘッダガードの対象パッケージ発見 [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", () => {
  it("新しく足したワークスペースパッケージも自動で対象になる [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    // 固定配列で列挙していると、packages/* に足したパッケージだけ規約の外に落ちる。
    const root = fixture({});
    mkdirSync(join(root, "packages/newpkg/src"), { recursive: true });
    writeFileSync(join(root, "packages/newpkg/src/noBasis.ts"), "export const x = 1;\n");

    const result = await runFailure(root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("basis header missing: packages/newpkg/src/noBasis.ts");
  });

  it("src を持たないパッケージがあっても失敗しない [PrjOps:SPEC-INT-070 / DevOps:SPEC-INT-084]", async () => {
    const root = fixture({});
    mkdirSync(join(root, "packages/docsonly"), { recursive: true });
    writeFileSync(join(root, "packages/docsonly/README.md"), "# docs only\n");

    const result = await runFailure(root);

    expect(result.stderr).toBe("");
    expect(result.code).toBe(0);
  });
});
