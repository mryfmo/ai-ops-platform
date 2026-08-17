// 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-001 / FinalArch:FR-UI-002 / FinalArch:FR-UI-006 / ADR-0025 / UX-002
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  MAX_RICH_RESULT_CARD_BYTES,
  parseRichResult,
  renderRichResultCard,
  type RichResult,
} from "../src/components/richResult.js";

const fixtures = [
  {
    kind: "status",
    title: "Release status",
    state: "healthy",
    summary: "All checks passed",
    facts: [{ label: "Version", value: "v42" }],
  },
  {
    kind: "table",
    title: "DORA metrics",
    columns: ["Metric", "Value"],
    rows: [
      ["Lead time", 12.5],
      ["Failures", 0],
    ],
  },
  {
    kind: "chart",
    title: "Deployments",
    chartType: "bar",
    series: [
      {
        name: "Deployments",
        points: [
          { label: "Mon", value: 2 },
          { label: "Tue", value: 4 },
          { label: "Wed", value: 0 },
          { label: "Thu", value: -2 },
        ],
      },
    ],
  },
  {
    kind: "incident",
    title: "API outage",
    severity: "SEV-1",
    status: "investigating",
    summary: "Requests are failing",
    url: "https://status.example.test/incidents/42",
  },
  {
    kind: "chart",
    title: "Lead time trend",
    chartType: "line",
    series: [
      {
        name: "Hours",
        points: [
          { label: "Mon", value: 8 },
          { label: "Tue", value: 4 },
          { label: "Wed", value: 6 },
        ],
      },
    ],
  },
  {
    kind: "pull_request",
    title: "Guard deployment",
    repository: "acme/platform",
    number: 42,
    state: "open",
    author: "octocat",
    url: "https://github.com/acme/platform/pull/42",
  },
  {
    kind: "sources",
    title: "Sources",
    sources: [
      {
        label: "Runbook",
        sourceId: "runbook/deploy",
        version: "sha256:abc123",
        url: "https://docs.example.test/runbooks/deploy",
      },
      {
        label: "Pull request",
        sourceId: "acme/platform/pull/42",
        version: "head:deadbeef",
        url: "https://github.com/acme/platform/pull/42",
      },
    ],
  },
] as const;

describe("FinalArch:FR-UI-006 typed rich result cards", () => {
  it("renders status/table/chart/incident/PR/source results deterministically", () => {
    const first = fixtures.map((fixture) => renderRichResultCard(parseRichResult(fixture)));
    const second = fixtures.map((fixture) => renderRichResultCard(parseRichResult(fixture)));

    expect(first).toMatchSnapshot();
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(
      first.every((card) => new TextEncoder().encode(JSON.stringify(card)).byteLength <= MAX_RICH_RESULT_CARD_BYTES),
    ).toBe(true);
  });

  it.each([
    { type: "AdaptiveCard", body: [{ type: "Image", url: "https://evil.example/pixel" }] },
    { kind: "unknown", title: "Unknown" },
    { ...fixtures[0], body: [{ type: "TextBlock", text: "injected" }] },
  ])("rejects unknown kinds, keys, and Adaptive Card JSON pass-through", (input) => {
    expect(() => parseRichResult(input)).toThrow("Invalid rich result");
  });

  it.each([
    { ...fixtures[0], summary: "<script>alert(1)</script>" },
    { ...fixtures[3], summary: "[click](javascript:alert(1))" },
    { ...fixtures[0], summary: "**untrusted emphasis**" },
    { ...fixtures[0], summary: "See https://evil.example/tracker" },
  ])("rejects markup instead of rendering it as a text slot", (input) => {
    expect(() => parseRichResult(input)).toThrow("plain text");
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,unsafe",
    "http://status.example.test/incidents/42",
    "https://user:password@status.example.test/incidents/42",
    "https://status.example.test/incidents/42#secret",
  ])("rejects unsafe result URLs before card rendering: %s", (url) => {
    expect(() => parseRichResult({ ...fixtures[3], url })).toThrow("HTTPS URL");
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects non-finite chart/table numbers: %s",
    (value) => {
      expect(() =>
        parseRichResult({ ...fixtures[2], series: [{ name: "Deployments", points: [{ label: "Mon", value }] }] }),
      ).toThrow("finite number");
      expect(() => parseRichResult({ ...fixtures[1], rows: [["Metric", value]] })).toThrow("finite number");
    },
  );

  it("fails closed when the serialized card exceeds the Teams size ceiling", () => {
    const oversized = parseRichResult({
      kind: "table",
      title: "Large table",
      columns: Array.from({ length: 10 }, (_, index) => `Column ${index}`),
      rows: Array.from({ length: 50 }, () => Array.from({ length: 10 }, () => "x".repeat(100))),
    });

    expect(() => renderRichResultCard(oversized)).toThrow(`exceeds ${MAX_RICH_RESULT_CARD_BYTES} bytes`);
  });

  it("exposes only the typed result renderer, not an arbitrary card-markup input", () => {
    expectTypeOf(renderRichResultCard).parameter(0).toEqualTypeOf<RichResult>();
    expectTypeOf<{ type: "AdaptiveCard"; body: readonly unknown[] }>().not.toMatchTypeOf<RichResult>();
    expect(() =>
      renderRichResultCard({ ...fixtures[0], summary: "<script>runtime bypass</script>" } as unknown as RichResult),
    ).toThrow("plain text");
  });
});
