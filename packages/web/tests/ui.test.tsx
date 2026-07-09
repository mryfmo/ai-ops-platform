/**
 * packages/web/tests/ui.test.tsx
 *
 * 根拠: ADR-0005（WebUIダッシュボード 共通UIキット）/ SPEC-EXT-020（ステータス色・ラベル併記）
 * React Testing Library を使わず、コンポーネント関数の戻り値（React要素のprops）を
 * 直接検証する軽量テスト。
 */
import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { Card } from "../src/components/ui/Card";
import { Badge, BADGE_VARIANT_CLASS } from "../src/components/ui/Badge";
import { StatusChip, STATUS_CHIP_CLASS, STATUS_LABEL_JA, type StatusColor } from "../src/components/ui/StatusChip";
import { DataTable, type DataTableColumn } from "../src/components/ui/DataTable";
import { ChartContainer } from "../src/components/ui/ChartContainer";
import { Skeleton } from "../src/components/ui/Skeleton";

/** React要素のpropsを検証用に取り出す（型はテスト内でのみ緩める） */
function propsOf(el: ReactElement): Record<string, unknown> {
  return el.props as Record<string, unknown>;
}

describe("StatusChip（ADR-0005 / SPEC-EXT-020: 色+ラベル併記）", () => {
  it("green/yellow/red にステータス色クラスと日本語ラベルを割り当てる", () => {
    const cases: Array<{ status: StatusColor; cls: string; label: string }> = [
      { status: "green", cls: "bg-status-green", label: "順調" },
      { status: "yellow", cls: "bg-status-yellow", label: "注意" },
      { status: "red", cls: "bg-status-red", label: "危険" },
    ];
    for (const c of cases) {
      const el = StatusChip({ status: c.status });
      const props = propsOf(el);
      expect(el.type).toBe("span");
      expect(String(props["className"])).toContain(c.cls);
      expect(props["children"]).toBe(c.label);
      expect(props["data-status"]).toBe(c.status);
    }
  });

  it("ラベル定義とクラス定義が3ステータスすべてを網羅する（色だけに依存しない表記）", () => {
    expect(STATUS_LABEL_JA).toEqual({ green: "順調", yellow: "注意", red: "危険" });
    for (const status of ["green", "yellow", "red"] as const) {
      expect(STATUS_CHIP_CLASS[status]).toContain(`bg-status-${status}`);
    }
  });
});

describe("Badge（ADR-0005）", () => {
  it("variant 未指定は default クラス、指定時は対応クラスを適用する", () => {
    const def = propsOf(Badge({ children: "x" }));
    expect(String(def["className"])).toContain(BADGE_VARIANT_CLASS.default);
    for (const variant of ["green", "yellow", "red"] as const) {
      const el = propsOf(Badge({ variant, children: "x" }));
      expect(String(el["className"])).toContain(BADGE_VARIANT_CLASS[variant]);
    }
  });
});

describe("Card（ADR-0005）", () => {
  it("枠・padding・shadow クラスを持つ section を返し、title 指定時は見出しを含む", () => {
    const el = Card({ title: "タイトル", children: "本文" });
    const props = propsOf(el);
    expect(el.type).toBe("section");
    const cls = String(props["className"]);
    expect(cls).toContain("border");
    expect(cls).toContain("p-4");
    expect(cls).toContain("shadow-sm");
    const [heading] = props["children"] as [ReactElement | null, unknown];
    expect(heading).not.toBeNull();
    expect((heading as ReactElement).type).toBe("h2");
    expect(propsOf(heading as ReactElement)["children"]).toBe("タイトル");
  });

  it("title 未指定時は見出しを描画しない", () => {
    const el = Card({ children: "本文" });
    const [heading] = propsOf(el)["children"] as [ReactElement | null, unknown];
    expect(heading).toBeNull();
  });
});

describe("DataTable（ADR-0005）", () => {
  interface Row {
    id: string;
    name: string;
  }
  const columns: DataTableColumn<Row>[] = [
    { key: "id", header: "ID", render: (r) => r.id },
    { key: "name", header: "名前", render: (r) => r.name },
  ];

  it("overflow-x-auto のラッパー内に table を描画する", () => {
    const el = DataTable<Row>({
      columns,
      rows: [{ id: "PRJ-0001", name: "案件A" }],
      rowKey: (r) => r.id,
    });
    const props = propsOf(el);
    expect(el.type).toBe("div");
    expect(String(props["className"])).toContain("overflow-x-auto");
    const table = props["children"] as ReactElement;
    expect(table.type).toBe("table");
  });

  it("rows が空のとき emptyMessage を colSpan=列数 のセルで表示する", () => {
    const el = DataTable<Row>({
      columns,
      rows: [],
      rowKey: (r) => r.id,
      emptyMessage: "0件です",
    });
    const table = propsOf(el)["children"] as ReactElement;
    const [, tbody] = propsOf(table)["children"] as [ReactElement, ReactElement];
    const emptyRow = propsOf(tbody)["children"] as ReactElement;
    const td = propsOf(emptyRow)["children"] as ReactElement;
    expect(td.type).toBe("td");
    expect(propsOf(td)["colSpan"]).toBe(columns.length);
    expect(propsOf(td)["children"]).toBe("0件です");
  });
});

describe("ChartContainer（ADR-0005）", () => {
  it("figure 要素にタイトルと説明を描画し、children を内包する", () => {
    const el = ChartContainer({
      title: "DORAメトリクス",
      description: "説明文",
      children: "chart-body",
    });
    const props = propsOf(el);
    expect(el.type).toBe("figure");
    const [figcaption, body] = props["children"] as [ReactElement, unknown];
    expect(figcaption.type).toBe("figcaption");
    expect(body).toBe("chart-body");
    const [titleEl, descEl] = propsOf(figcaption)["children"] as [ReactElement, ReactElement | null];
    expect(propsOf(titleEl)["children"]).toBe("DORAメトリクス");
    expect(descEl).not.toBeNull();
    expect(propsOf(descEl as ReactElement)["children"]).toBe("説明文");
  });
});

describe("Skeleton（ADR-0005）", () => {
  it("animate-pulse のプレースホルダを返し、追加クラスを合成する", () => {
    const el = Skeleton({ className: "h-4 w-32" });
    const props = propsOf(el);
    const cls = String(props["className"]);
    expect(cls).toContain("animate-pulse");
    expect(cls).toContain("h-4 w-32");
    expect(props["aria-hidden"]).toBe("true");
  });
});
