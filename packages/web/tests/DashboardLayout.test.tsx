/**
 * @vitest-environment jsdom
 * 根拠: REQ-037 / SPEC-INT-063 / AC-037-1 / ADR-0008。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DashboardLayout from "../src/app/dashboard/layout";

const PERSONA_BRANCHES = ["none", "PRF-01", "PRF-02", "PRF-03", "PRF-04", "PRF-05/investor", "PRF-M", "PRF-L", "PRF-G"];

describe("Excel取込dashboard導線 [REQ-037 / SPEC-INT-063 / AC-037-1]", () => {
  it.each(PERSONA_BRANCHES)("%s 分岐から専用Excel取込pageへ到達できる", (persona) => {
    const html = renderToStaticMarkup(
      <DashboardLayout>
        <div>{persona}</div>
      </DashboardLayout>,
    );

    expect(html).toContain('href="/app/dashboard/xlsx-import"');
    expect(html).toContain("Excel取込");
  });
});
