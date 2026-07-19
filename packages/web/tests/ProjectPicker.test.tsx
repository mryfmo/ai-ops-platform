/**
 * @vitest-environment jsdom
 *
 * packages/web/tests/ProjectPicker.test.tsx
 *
 * 根拠: P010-F02-T10 / DEC-SPEC-008 / PrjOps:REQ-041 / DevOps:REQ-041。
 * native select の accessible name、focus、URL navigation、改変 option 拒否を検証する。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  pathname: "/dashboard",
  params: "view=summary",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams(navigation.params),
}));

const { ProjectPicker } = await import("../src/components/ProjectPicker");

function renderPicker(props: Parameters<typeof ProjectPicker>[0]): {
  container: HTMLDivElement;
  root: Root;
  select: HTMLSelectElement;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<ProjectPicker {...props} />));
  return { container, root, select: container.querySelector("select")! };
}

const projects = [
  { id: "PJ-001", name: "案件A" },
  { id: "PJ-002", name: "案件B" },
];

beforeEach(() => {
  vi.clearAllMocks();
  navigation.params = "view=summary";
  document.body.replaceChildren();
});

describe("ProjectPicker [PrjOps:REQ-041 / DevOps:REQ-041 / DEC-SPEC-008]", () => {
  it("label・focus・未選択案内をnative selectで提供する", () => {
    const { container, root, select } = renderPicker({ projects, portfolioAllowed: false });
    expect(container.querySelector(`label[for="${select.id}"]`)?.textContent).toContain("プロジェクト");
    expect(document.activeElement).toBe(select);
    expect(select.value).toBe("");
    expect(container.querySelector('[role="status"]')?.textContent).toContain("選択してください");
    act(() => root.unmount());
  });

  it("選択時は既存queryを保ってprojectだけをURLへpushする", () => {
    const { root, select } = renderPicker({ projects, portfolioAllowed: false });
    act(() => {
      select.value = "PJ-002";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(navigation.push).toHaveBeenCalledWith("/dashboard?view=summary&project=PJ-002");
    act(() => root.unmount());
  });

  it("portfolioAllowedのときだけUIがall optionを合成する", () => {
    const denied = renderPicker({ projects, portfolioAllowed: false });
    expect([...denied.select.options].map((option) => option.value)).not.toContain("all");
    act(() => denied.root.unmount());

    const allowed = renderPicker({ projects, portfolioAllowed: true, selected: "all" });
    expect([...allowed.select.options].map((option) => option.value)).toContain("all");
    expect(allowed.select.value).toBe("all");
    act(() => allowed.root.unmount());
  });

  it("1件自動選択はreplaceでcanonical URLにし、履歴を増やさない", async () => {
    const { root } = renderPicker({
      projects: [projects[0]!],
      portfolioAllowed: false,
      selected: "PJ-001",
      autoSelected: true,
    });
    await act(async () => Promise.resolve());
    expect(navigation.replace).toHaveBeenCalledWith("/dashboard?view=summary&project=PJ-001");
    act(() => root.unmount());
  });

  it("DOM改変optionはnavigationせずalertで通知する", () => {
    const { container, root, select } = renderPicker({ projects, portfolioAllowed: false });
    select.append(new Option("改変", "PJ-999"));
    act(() => {
      select.value = "PJ-999";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(navigation.push).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("選択できません");
    act(() => root.unmount());
  });

  it("server側のmalformed・stale errorをaria-live alertで表示する", () => {
    const { container, root, select } = renderPicker({
      projects,
      portfolioAllowed: false,
      error: "E-AUTH07: project is not accessible",
    });
    expect(select.getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelector('[role="alert"]')?.getAttribute("aria-live")).toBe("assertive");
    act(() => root.unmount());
  });
});
