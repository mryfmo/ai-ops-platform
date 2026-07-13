/**
 * @vitest-environment jsdom
 *
 * packages/web/tests/PersonaSelector.test.tsx
 * 根拠: ADR-0005 / AUD-IMP-006。ラベル付きセレクタが検証 API を経由することを確認する。
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { PersonaSelector } from "../src/components/PersonaSelector";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("PersonaSelector [REQ-041 / SPEC-INT-068]", () => {
  it("アクセシブルなselectから検証 API へ選択値を送る [REQ-041 / SPEC-INT-068]", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(
        <PersonaSelector
          options={[
            { key: "prjops:PRF-04", label: "PrjOps PRF-04" },
            { key: "devops:PRF-G", label: "DevOps PRF-G" },
          ]}
          selectedKey="prjops:PRF-04"
        />,
      );
    });
    const select = container.querySelector("select")!;
    expect(container.querySelector('label[for="persona-selector"]')).not.toBeNull();
    await act(async () => {
      select.value = "devops:PRF-G";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledWith("/app/api/persona", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona: "devops:PRF-G" }),
    });
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    act(() => root.unmount());
  });
});
