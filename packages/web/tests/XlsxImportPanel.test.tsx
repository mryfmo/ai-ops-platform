/**
 * @vitest-environment jsdom
 * packages/web/tests/XlsxImportPanel.test.tsx
 * 根拠: REQ-037 / SPEC-INT-063 / AC-037-1 / ADR-0008。
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { XlsxImportPanel } from "../src/components/XlsxImportPanel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function button(container: HTMLElement, text: string): HTMLButtonElement {
  return Array.from(container.querySelectorAll("button")).find((item) => item.textContent?.includes(text))!;
}

describe("Excel取込UI [REQ-037 / AC-037-1]", () => {
  it("dry-runエラーを全列表示し、成功後の明示確認でのみexecuteする", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          ok: false,
          rowCount: 0,
          summary: "2 errors",
          errors: [
            { sheet: "issues", row: 2, column: "title", code: "E-1", message: "missing" },
            { sheet: "milestones", row: 3, message: "invalid date" },
          ],
        }),
      )
      .mockResolvedValueOnce(Response.json({ ok: true, rowCount: 1, summary: "accepted", errors: [] }))
      .mockResolvedValueOnce(Response.json({ ok: true, result: { summary: "executed" } }));
    vi.stubGlobal("fetch", fetchMock);
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => root.render(<XlsxImportPanel />));
    const input = container.querySelector<HTMLInputElement>("input[type=file]")!;
    const file = new File(["xlsx"], "plan.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));

    await act(async () => button(container, "dry-run").click());
    expect(container.textContent).toContain("issues");
    expect(container.textContent).toContain("milestones");
    expect(container.textContent).toContain("Column");
    expect(container.textContent).not.toContain("取込を実行");

    await act(async () => button(container, "dry-run").click());
    const owner = container.querySelectorAll<HTMLInputElement>('input[type="text"]')[0]!;
    const repo = container.querySelectorAll<HTMLInputElement>('input[type="text"]')[1]!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setValue.call(owner, "acme");
      owner.dispatchEvent(new Event("input", { bubbles: true }));
      setValue.call(repo, "widget");
      repo.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const execute = button(container, "取込を実行");
    expect(execute.disabled).toBe(true);
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    await act(async () => checkbox.click());
    expect(execute.disabled).toBe(false);
    await act(async () => execute.click());
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining("operation=execute"),
      expect.objectContaining({ headers: expect.objectContaining({ "x-confirm-import": "yes" }) }),
    );
    expect(container.textContent).toContain("executed");
    await act(async () => root.unmount());
  });
});
