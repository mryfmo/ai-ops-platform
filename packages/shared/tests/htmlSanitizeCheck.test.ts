import { describe, it, expect } from "vitest";
import {
  checkNoPlaceholders,
  checkFileSizeWithinLimit,
  checkNoExternalReferences,
  extractDataSrcRefs,
  verifyNumericConsistency,
  checkForbiddenTerms,
} from "../src/html/htmlSanitizeCheck.js";

describe("checkNoPlaceholders [PrjOps:SPEC-INT-051(c)]", () => {
  it("プレースホルダなしのHTMLはok=true", () => {
    expect(checkNoPlaceholders("<p>進捗率62%</p>").ok).toBe(true);
  });
  it("{{ }} が残っているとNG", () => {
    expect(checkNoPlaceholders("<p>{{progress}}</p>").ok).toBe(false);
  });
  it("undefined/nullの文字列出現もNG", () => {
    expect(checkNoPlaceholders("<p>進捗: undefined</p>").ok).toBe(false);
    expect(checkNoPlaceholders("<p>備考: null</p>").ok).toBe(false);
  });
});

describe("checkFileSizeWithinLimit [PrjOps:REQ-010 AC-010-2]", () => {
  it("2MB以下はtrue", () => {
    expect(checkFileSizeWithinLimit("x".repeat(1000))).toBe(true);
  });
  it("2MB超過はfalse", () => {
    expect(checkFileSizeWithinLimit("x".repeat(2 * 1024 * 1024 + 1))).toBe(false);
  });
});

describe("checkNoExternalReferences [PrjOps:REQ-010 AC-010-1]", () => {
  it("外部参照がなければok", () => {
    expect(checkNoExternalReferences("<style>body{color:red}</style>").ok).toBe(true);
  });
  it("外部scriptがあればNG", () => {
    const r = checkNoExternalReferences('<script src="https://cdn.example.com/x.js"></script>');
    expect(r.ok).toBe(false);
    expect(r.offenders).toContain("external <script src>");
  });
});

describe("extractDataSrcRefs / verifyNumericConsistency [PrjOps:SPEC-INT-051(a)]", () => {
  const html = `
    <span data-src="status_updates/SU-PJ-001-2026-W27-1#progress_pct">62</span>
    <span data-src="projects/PJ-001#plan_line_pct">65</span>
  `;
  it("data-src参照を抽出する", () => {
    const refs = extractDataSrcRefs(html);
    expect(refs).toHaveLength(2);
    expect(refs[0]).toMatchObject({ field: "progress_pct", displayedValue: "62" });
  });
  it("正本と一致すればok", () => {
    const result = verifyNumericConsistency(html, (path, field) => {
      if (path === "status_updates/SU-PJ-001-2026-W27-1" && field === "progress_pct") return "62";
      if (path === "projects/PJ-001" && field === "plan_line_pct") return "65";
      return undefined;
    });
    expect(result.ok).toBe(true);
    expect(result.checkedCount).toBe(2);
  });
  it("不一致があればmismatchesに記録される", () => {
    const result = verifyNumericConsistency(html, (path, field) => {
      if (path === "status_updates/SU-PJ-001-2026-W27-1" && field === "progress_pct") return "99"; // 不一致
      return "65";
    });
    expect(result.ok).toBe(false);
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]?.field).toBe("progress_pct");
  });
});

describe("checkForbiddenTerms [PrjOps:SPEC-INT-051(b) 権限違反検査]", () => {
  it("PRF-05向けレポートに個人名が含まれていればNG", () => {
    const html = "<p>田中太郎さんが担当しています</p>";
    const r = checkForbiddenTerms(html, ["田中太郎"]);
    expect(r.ok).toBe(false);
    expect(r.found).toContain("田中太郎");
  });
  it("禁止語彙が含まれなければok", () => {
    const html = "<p>ポートフォリオ全体は順調です</p>";
    expect(checkForbiddenTerms(html, ["田中太郎", "社内システムX"]).ok).toBe(true);
  });
});
