/** 根拠: FinalArch:FR-CP-008 / ADR-0029 / P10-T04 / ADV-FIX-01 H-1 */
import fs from "node:fs";

import { describe, expect, it } from "vitest";

describe("database role provisioning [FinalArch:FR-CP-008 / ADR-0029]", () => {
  it("server DB repoがUPDATEする全tableをmutable grantへ含める", () => {
    const rolesSql = fs.readFileSync(new URL("../src/db/provision_database_roles.sql", import.meta.url), "utf8");
    const mutableArray = rolesSql.match(/FOREACH mutable_table IN ARRAY ARRAY\[([\s\S]*?)\]\s*LOOP/u)?.[1] ?? "";
    const granted = new Set([...mutableArray.matchAll(/'([a-z][a-z0-9_]*)'/gu)].map((match) => match[1]));
    const dbDirectory = new URL("../../server/src/db/", import.meta.url);
    const updated = new Set<string>();

    for (const file of fs.readdirSync(dbDirectory).filter((name) => name.endsWith(".ts"))) {
      const source = fs.readFileSync(new URL(file, dbDirectory), "utf8");
      for (const match of source.matchAll(/(?<!\bDO )(?<!\bFOR )\bUPDATE\s+([a-z][a-z0-9_]*)\b/giu)) {
        updated.add(match[1]!.toLowerCase());
      }
    }

    expect([...updated].filter((table) => !granted.has(table)).sort()).toEqual([]);
  });
});
