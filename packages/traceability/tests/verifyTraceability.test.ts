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
  if (normalized.sourceText !== undefined) {
    writeFileSync(join(root, "packages/shared/src/references.ts"), normalized.sourceText);
  }
  if (normalized.traceabilitySourceText !== undefined) {
    writeFileSync(join(root, "packages/traceability/src/references.ts"), normalized.traceabilitySourceText);
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
