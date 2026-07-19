/**
 * 根拠: P010-F02-T02 / DEC-SPEC-001
 */
import { readFileSync } from "node:fs";
import { stringify } from "yaml";
import { describe, expect, it } from "vitest";
import {
  SNAPSHOT_ERROR_CODES,
  buildPrjopsDataManifest,
  validatePrjopsDataSnapshot,
  type SnapshotEntry,
  type SnapshotErrorCode,
} from "../src/lib/prjopsDataSnapshotValidator.js";

interface GoldenVector {
  id: string;
  inputs: Array<{ path: string; entry_kind: string; bytes_base64: string }>;
  expected_manifest_bytes_base64: string | null;
  expected_content_sha256: string | null;
  expected_error_code: SnapshotErrorCode | null;
}

const goldenVectors = (
  JSON.parse(
    readFileSync(new URL("../../../docs/contracts/fixtures/checksum-golden-vectors.json", import.meta.url), "utf8"),
  ) as { vectors: GoldenVector[] }
).vectors;

const lifecycle = {
  active: true,
  created_at: "2026-07-18T00:00:00Z",
  updated_at: "2026-07-18T00:00:00Z",
  updated_by: "ST-001",
  deactivated_at: null,
  deactivation_reason: null,
};

function validDocuments(): Record<string, Record<string, unknown>> {
  return {
    "organizations/ORG-001.yaml": {
      id: "ORG-001",
      name: "Example Organization",
      country: "JP",
      domestic_or_overseas: "domestic",
      ...lifecycle,
    },
    "projects/PJ-001.yaml": {
      id: "PJ-001",
      name: "Example Project",
      leader_id: "ST-001",
      manager_id: "ST-001",
      organization_ids: ["ORG-001"],
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      report_frequency: "weekly",
      status: "active",
      ...lifecycle,
    },
    "stakeholders/ST-001.yaml": {
      id: "ST-001",
      name: "Example User",
      organization_id: "ORG-001",
      entra_tenant_id: "11111111-1111-1111-1111-111111111111",
      entra_object_id: "22222222-2222-2222-2222-222222222222",
      assignments: [
        {
          domain: "prjops",
          profile: "PRF-02",
          scope_mode: "project",
          project_id: "PJ-001",
          active: true,
        },
      ],
      invested_project_ids: [],
      email: "user@example.com",
      teams_user_id: "teams-ST-001",
      preferred_language: "ja",
      timezone: "Asia/Tokyo",
      ...lifecycle,
    },
    "investor/financial_inputs.yaml": {
      currency: "JPY",
      as_of: "2026-06-30",
      projects: [{ project_id: "PJ-001", ownership_pct: 100, revenue: 1000, ebitda: 100 }],
      updated_at: "2026-07-18T00:00:00Z",
      updated_by: "ST-001",
    },
    "investor/board_pack.yaml": {
      targets: { revenue: 1200, ebitda: 120 },
      history: [
        {
          as_of: "2026-03-31",
          companies: [{ project_id: "PJ-001", ownership_pct: 100, revenue: 900, ebitda: 90 }],
        },
      ],
      updated_at: "2026-07-18T00:00:00Z",
      updated_by: "ST-001",
    },
  };
}

function entry(path: string, document: unknown): SnapshotEntry {
  return { path, kind: "regular", bytes: Buffer.from(stringify(document)) };
}

function snapshot(
  mutate: (documents: Record<string, Record<string, unknown>>) => void = () => undefined,
): SnapshotEntry[] {
  const documents = validDocuments();
  mutate(documents);
  const dataEntries = Object.entries(documents).map(([path, document]) => entry(path, document));
  const manifest = buildPrjopsDataManifest(dataEntries);
  if (!manifest.ok) throw new Error(manifest.code);
  return [
    entry("schema/version.yaml", {
      schema_version: "1.0.0",
      generated_at: "2026-07-18T00:00:00Z",
      content_sha256: manifest.contentSha256,
    }),
    ...dataEntries,
  ];
}

function expectCode(entries: SnapshotEntry[], code: SnapshotErrorCode): void {
  expect(validatePrjopsDataSnapshot(entries)).toMatchObject({ ok: false, code });
}

describe("buildPrjopsDataManifest [P010-F02-T02, DEC-SPEC-001]", () => {
  it.each(goldenVectors)("$id consumes the contract golden vector", (vector) => {
    const result = buildPrjopsDataManifest(
      vector.inputs.map((input) => ({
        path: input.path,
        kind: input.entry_kind,
        bytes: Buffer.from(input.bytes_base64, "base64"),
      })),
    );

    if (vector.expected_error_code) {
      expect(result).toEqual({ ok: false, code: vector.expected_error_code });
      return;
    }
    expect(result).toMatchObject({ ok: true, contentSha256: vector.expected_content_sha256 });
    if (result.ok) {
      expect(Buffer.from(result.manifestBytes).toString("base64")).toBe(vector.expected_manifest_bytes_base64);
    }
  });

  it("uses the contract failure-table priority when one entry violates multiple byte rules", () => {
    expect(
      buildPrjopsDataManifest([
        {
          path: "../unknown",
          kind: "symlink",
          bytes: Buffer.from([0xef, 0xbb, 0xbf, 0xc3, 0x28, 0x0d]),
        },
      ]),
    ).toEqual({ ok: false, code: "E-SNAPSHOT-SYMLINK" });
  });
});

describe("validatePrjopsDataSnapshot [P010-F02-T02, DEC-SPEC-001]", () => {
  it("accepts a complete strict snapshot with matching checksum", () => {
    const result = validatePrjopsDataSnapshot(snapshot());
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.documents.map((document) => [document.kind, document.path])).toContainEqual([
        "project",
        "projects/PJ-001.yaml",
      ]);
    }
  });

  it("accepts seven key assessments without adding a uniqueItems rule absent from the contract schema", () => {
    expect(
      validatePrjopsDataSnapshot(
        snapshot((documents) => {
          documents["seven_keys/snapshots/SKS-001.yaml"] = {
            id: "SKS-001",
            project_id: "PJ-001",
            month: "2026-06",
            name: "Contract-shaped snapshot",
            keys: Array.from({ length: 7 }, () => ({ key_id: "K1", rag: "green", basis: "Measured" })),
            improved_keys: [],
            worsened_keys: [],
            trace_id: "trace-001",
            created_at: "2026-07-18T00:00:00Z",
          };
        }),
      ),
    ).toMatchObject({ ok: true });
  });

  it("returns E-SNAPSHOT-SCHEMA for malformed YAML and noncanonical IDs", () => {
    const malformed = snapshot();
    malformed.find((item) => item.path === "organizations/ORG-001.yaml")!.bytes = Buffer.from("id: [\n");
    expectCode(malformed, "E-SNAPSHOT-SCHEMA");

    expectCode(
      snapshot((documents) => {
        documents["organizations/ORG-001.yaml"]!.id = "ORG-x";
      }),
      "E-SNAPSHOT-SCHEMA",
    );
  });

  it("returns E-SNAPSHOT-SCHEMA for duplicate keys, aliases, and merge keys", () => {
    for (const bytes of [
      "id: ORG-001\nid: ORG-001\n",
      "id: ORG-001\nname: &name Example\ncopy: *name\n",
      "id: ORG-001\n<<: {name: Example}\n",
    ]) {
      const entries = snapshot();
      entries.find((item) => item.path === "organizations/ORG-001.yaml")!.bytes = Buffer.from(bytes);
      expectCode(entries, "E-SNAPSHOT-SCHEMA");
    }
  });

  it("returns E-SNAPSHOT-UNKNOWN-FIELD for a strict-schema extra field", () => {
    expectCode(
      snapshot((documents) => {
        documents["organizations/ORG-001.yaml"]!.unexpected = true;
      }),
      "E-SNAPSHOT-UNKNOWN-FIELD",
    );
  });

  it("prioritizes a schema violation over an unknown field and checksum mismatch", () => {
    const entries = snapshot((documents) => {
      documents["organizations/ORG-001.yaml"]!.unexpected = true;
    });
    entries.find((item) => item.path === "projects/PJ-001.yaml")!.bytes = Buffer.from("id: [\n");
    expectCode(entries, "E-SNAPSHOT-SCHEMA");
  });

  it("returns E-SNAPSHOT-FILENAME-ID for a filename/document identity mismatch", () => {
    expectCode(
      snapshot((documents) => {
        documents["organizations/ORG-001.yaml"]!.id = "ORG-002";
      }),
      "E-SNAPSHOT-FILENAME-ID",
    );
  });

  it("returns E-SNAPSHOT-DUPLICATE-ID for a duplicate record path/identity", () => {
    const entries = snapshot();
    entries.push(entries.find((item) => item.path === "organizations/ORG-001.yaml")!);
    expectCode(entries, "E-SNAPSHOT-DUPLICATE-ID");
  });

  it("returns E-SNAPSHOT-DUPLICATE-MAPPING for a repeated stable subject", () => {
    expectCode(
      snapshot((documents) => {
        documents["stakeholders/ST-002.yaml"] = {
          ...documents["stakeholders/ST-001.yaml"],
          id: "ST-002",
          email: "other@example.com",
          teams_user_id: "teams-ST-002",
        };
      }),
      "E-SNAPSHOT-DUPLICATE-MAPPING",
    );
  });

  it("returns E-SNAPSHOT-REFERENCE for a dangling cross-reference", () => {
    expectCode(
      snapshot((documents) => {
        documents["projects/PJ-001.yaml"]!.manager_id = "ST-404";
      }),
      "E-SNAPSHOT-REFERENCE",
    );
  });

  it("returns E-SNAPSHOT-OWNERSHIP outside the inclusive 0..100 boundary", () => {
    for (const ownership of [-0.01, 100.01]) {
      expectCode(
        snapshot((documents) => {
          (documents["investor/financial_inputs.yaml"]!.projects as Array<Record<string, unknown>>)[0]!.ownership_pct =
            ownership;
        }),
        "E-SNAPSHOT-OWNERSHIP",
      );
    }
  });

  it.each(["schema/version.yaml", "investor/financial_inputs.yaml", "investor/board_pack.yaml"])(
    "returns E-SNAPSHOT-PARTIAL when required singleton %s is absent",
    (path) => {
      expectCode(
        snapshot().filter((item) => item.path !== path),
        "E-SNAPSHOT-PARTIAL",
      );
    },
  );

  it("returns E-SNAPSHOT-CHECKSUM when version digest differs", () => {
    const entries = snapshot();
    entries.find((item) => item.path === "schema/version.yaml")!.bytes = Buffer.from(
      stringify({
        schema_version: "1.0.0",
        generated_at: "2026-07-18T00:00:00Z",
        content_sha256: "0".repeat(64),
      }),
    );
    expectCode(entries, "E-SNAPSHOT-CHECKSUM");
  });

  it("covers every contract failure code without inventing another code", () => {
    const covered = new Set<SnapshotErrorCode>(
      goldenVectors.flatMap((vector) => (vector.expected_error_code ? [vector.expected_error_code] : [])),
    );
    for (const code of [
      "E-SNAPSHOT-SCHEMA",
      "E-SNAPSHOT-UNKNOWN-FIELD",
      "E-SNAPSHOT-FILENAME-ID",
      "E-SNAPSHOT-DUPLICATE-ID",
      "E-SNAPSHOT-DUPLICATE-MAPPING",
      "E-SNAPSHOT-REFERENCE",
      "E-SNAPSHOT-OWNERSHIP",
      "E-SNAPSHOT-PARTIAL",
      "E-SNAPSHOT-CHECKSUM",
    ] satisfies SnapshotErrorCode[]) {
      covered.add(code);
    }
    expect(covered).toEqual(new Set(SNAPSHOT_ERROR_CODES));
  });
});
