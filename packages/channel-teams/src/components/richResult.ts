// 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-001 / FinalArch:FR-UI-002 / FinalArch:FR-UI-006 / ADR-0025 / UX-002

declare const plainTextBrand: unique symbol;
declare const httpsUrlBrand: unique symbol;

export type PlainText = string & { readonly [plainTextBrand]: true };
export type HttpsUrl = string & { readonly [httpsUrlBrand]: true };

export interface StatusResult {
  readonly kind: "status";
  readonly title: PlainText;
  readonly state: "healthy" | "warning" | "failed" | "unknown";
  readonly summary: PlainText;
  readonly facts: readonly ResultFact[];
}

export interface ResultFact {
  readonly label: PlainText;
  readonly value: PlainText;
}

export interface TableResult {
  readonly kind: "table";
  readonly title: PlainText;
  readonly columns: readonly PlainText[];
  readonly rows: readonly (readonly (PlainText | number | null)[])[];
}

export interface ChartResult {
  readonly kind: "chart";
  readonly title: PlainText;
  readonly chartType: "bar" | "line";
  readonly series: readonly ChartSeries[];
}

export interface ChartSeries {
  readonly name: PlainText;
  readonly points: readonly ChartPoint[];
}

export interface ChartPoint {
  readonly label: PlainText;
  readonly value: number;
}

export interface IncidentResult {
  readonly kind: "incident";
  readonly title: PlainText;
  readonly severity: "SEV-0" | "SEV-1" | "SEV-2" | "SEV-3";
  readonly status: "investigating" | "identified" | "monitoring" | "resolved";
  readonly summary: PlainText;
  readonly url: HttpsUrl;
}

export interface PullRequestResult {
  readonly kind: "pull_request";
  readonly title: PlainText;
  readonly repository: PlainText;
  readonly number: number;
  readonly state: "open" | "merged" | "closed";
  readonly author: PlainText;
  readonly url: HttpsUrl;
}

export interface SourcesResult {
  readonly kind: "sources";
  readonly title: PlainText;
  readonly sources: readonly SourceReference[];
}

export interface SourceReference {
  readonly label: PlainText;
  readonly sourceId: PlainText;
  readonly version: PlainText;
  readonly url: HttpsUrl;
}

export type RichResult = StatusResult | TableResult | ChartResult | IncidentResult | PullRequestResult | SourcesResult;

export interface RichResultAdaptiveCard {
  readonly $schema: "http://adaptivecards.io/schemas/adaptive-card.json";
  readonly type: "AdaptiveCard";
  readonly version: "1.5";
  readonly body: readonly RichCardElement[];
  readonly actions: readonly RichCardOpenUrlAction[];
}

type RichCardElement =
  | {
      readonly type: "TextBlock";
      readonly text: string;
      readonly wrap: true;
      readonly weight?: "Bolder";
      readonly size?: "Medium";
      readonly color?: "Accent" | "Good" | "Warning" | "Attention";
    }
  | { readonly type: "FactSet"; readonly facts: readonly { readonly title: string; readonly value: string }[] }
  | {
      readonly type: "Table";
      readonly firstRowAsHeaders: true;
      readonly showGridLines: true;
      readonly columns: readonly { readonly width: 1 }[];
      readonly rows: readonly RichCardTableRow[];
    };

interface RichCardTableRow {
  readonly type: "TableRow";
  readonly cells: readonly {
    readonly type: "TableCell";
    readonly items: readonly [{ readonly type: "TextBlock"; readonly text: string; readonly wrap: true }];
  }[];
}

interface RichCardOpenUrlAction {
  readonly type: "Action.OpenUrl";
  readonly title: string;
  readonly url: string;
}

/** Conservative common ceiling for Teams card delivery paths.
 * https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook
 */
export const MAX_RICH_RESULT_CARD_BYTES = 28 * 1024;

const MAX_TEXT_LENGTH = 512;
const MAX_FACTS = 20;
const MAX_TABLE_COLUMNS = 10;
const MAX_TABLE_ROWS = 50;
const MAX_CHART_SERIES = 8;
const MAX_CHART_POINTS = 50;
const MAX_SOURCES = 6;
const MARKUP =
  /[<>`]|!?\[[^\]]*\]\([^)]*\)|(^|\n)\s{0,3}(?:#{1,6}|>|[-+*]|\d+\.)\s|\*{1,3}[^*\n]+\*{1,3}|_{1,3}[^_\n]+_{1,3}|\b(?:https?|javascript|data):/iu;

function invalid(detail: string): never {
  throw new TypeError(`Invalid rich result: ${detail}`);
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return invalid(`${field} must be an object`);
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): void {
  const allowed = new Set([...required, ...optional]);
  if (required.some((key) => !Object.hasOwn(value, key)) || Object.keys(value).some((key) => !allowed.has(key))) {
    invalid("unknown or missing field");
  }
}

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0)!;
    return codePoint <= 31 || codePoint === 127;
  });
}

function plainText(value: unknown, field: string): PlainText {
  if (typeof value !== "string") return invalid(`${field} must be plain text`);
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > MAX_TEXT_LENGTH ||
    hasControlCharacter(normalized) ||
    MARKUP.test(normalized)
  ) {
    return invalid(`${field} must be plain text`);
  }
  return normalized as PlainText;
}

function httpsUrl(value: unknown, field: string): HttpsUrl {
  if (typeof value !== "string" || value !== value.trim()) return invalid(`${field} must be an absolute HTTPS URL`);
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) {
      return invalid(`${field} must be an absolute HTTPS URL`);
    }
    return parsed.toString() as HttpsUrl;
  } catch {
    return invalid(`${field} must be an absolute HTTPS URL`);
  }
}

function array(value: unknown, field: string, min: number, max: number): readonly unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    return invalid(`${field} must contain ${min}-${max} items`);
  }
  return value;
}

function oneOf<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) return invalid(`${field} is unsupported`);
  return value as T;
}

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return invalid(`${field} must be a finite number`);
  return Object.is(value, -0) ? 0 : value;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) return invalid(`${field} must be a positive integer`);
  return Number(value);
}

function parseFacts(value: unknown): readonly ResultFact[] {
  if (value === undefined) return [];
  return array(value, "facts", 0, MAX_FACTS).map((item, index) => {
    const fact = record(item, `facts[${index}]`);
    exactKeys(fact, ["label", "value"]);
    return { label: plainText(fact.label, "fact label"), value: plainText(fact.value, "fact value") };
  });
}

function parseStatus(input: Record<string, unknown>): StatusResult {
  exactKeys(input, ["kind", "title", "state", "summary"], ["facts"]);
  return {
    kind: "status",
    title: plainText(input.title, "title"),
    state: oneOf(input.state, "status state", ["healthy", "warning", "failed", "unknown"]),
    summary: plainText(input.summary, "summary"),
    facts: parseFacts(input.facts),
  };
}

function parseTableCell(value: unknown): PlainText | number | null {
  if (value === null) return null;
  return typeof value === "number" ? finiteNumber(value, "table cell") : plainText(value, "table cell");
}

function parseTable(input: Record<string, unknown>): TableResult {
  exactKeys(input, ["kind", "title", "columns", "rows"]);
  const columns = array(input.columns, "columns", 1, MAX_TABLE_COLUMNS).map((value) => plainText(value, "column"));
  const rows = array(input.rows, "rows", 1, MAX_TABLE_ROWS).map((value, rowIndex) => {
    const row = array(value, `rows[${rowIndex}]`, columns.length, columns.length);
    return row.map(parseTableCell);
  });
  return { kind: "table", title: plainText(input.title, "title"), columns, rows };
}

function parseChart(input: Record<string, unknown>): ChartResult {
  exactKeys(input, ["kind", "title", "chartType", "series"]);
  const series = array(input.series, "series", 1, MAX_CHART_SERIES).map((item, seriesIndex) => {
    const candidate = record(item, `series[${seriesIndex}]`);
    exactKeys(candidate, ["name", "points"]);
    const points = array(candidate.points, "points", 1, MAX_CHART_POINTS).map((point, pointIndex) => {
      const candidatePoint = record(point, `points[${pointIndex}]`);
      exactKeys(candidatePoint, ["label", "value"]);
      return {
        label: plainText(candidatePoint.label, "point label"),
        value: finiteNumber(candidatePoint.value, "point value"),
      };
    });
    return { name: plainText(candidate.name, "series name"), points };
  });
  return {
    kind: "chart",
    title: plainText(input.title, "title"),
    chartType: oneOf(input.chartType, "chart type", ["bar", "line"]),
    series,
  };
}

function parseIncident(input: Record<string, unknown>): IncidentResult {
  exactKeys(input, ["kind", "title", "severity", "status", "summary", "url"]);
  return {
    kind: "incident",
    title: plainText(input.title, "title"),
    severity: oneOf(input.severity, "incident severity", ["SEV-0", "SEV-1", "SEV-2", "SEV-3"]),
    status: oneOf(input.status, "incident status", ["investigating", "identified", "monitoring", "resolved"]),
    summary: plainText(input.summary, "summary"),
    url: httpsUrl(input.url, "incident URL"),
  };
}

function parsePullRequest(input: Record<string, unknown>): PullRequestResult {
  exactKeys(input, ["kind", "title", "repository", "number", "state", "author", "url"]);
  return {
    kind: "pull_request",
    title: plainText(input.title, "title"),
    repository: plainText(input.repository, "repository"),
    number: positiveInteger(input.number, "pull request number"),
    state: oneOf(input.state, "pull request state", ["open", "merged", "closed"]),
    author: plainText(input.author, "author"),
    url: httpsUrl(input.url, "pull request URL"),
  };
}

function parseSources(input: Record<string, unknown>): SourcesResult {
  exactKeys(input, ["kind", "title", "sources"]);
  const sources = array(input.sources, "sources", 1, MAX_SOURCES).map((item, index) => {
    const source = record(item, `sources[${index}]`);
    exactKeys(source, ["label", "sourceId", "version", "url"]);
    return {
      label: plainText(source.label, "source label"),
      sourceId: plainText(source.sourceId, "source ID"),
      version: plainText(source.version, "source version"),
      url: httpsUrl(source.url, "source URL"),
    };
  });
  return { kind: "sources", title: plainText(input.title, "title"), sources };
}

export function parseRichResult(input: unknown): RichResult {
  const candidate = record(input, "root");
  switch (candidate.kind) {
    case "status":
      return parseStatus(candidate);
    case "table":
      return parseTable(candidate);
    case "chart":
      return parseChart(candidate);
    case "incident":
      return parseIncident(candidate);
    case "pull_request":
      return parsePullRequest(candidate);
    case "sources":
      return parseSources(candidate);
    default:
      return invalid("unknown kind");
  }
}

function title(text: PlainText): RichCardElement {
  return { type: "TextBlock", text, wrap: true, weight: "Bolder", size: "Medium" };
}

function facts(entries: readonly { readonly title: string; readonly value: string }[]): RichCardElement {
  return { type: "FactSet", facts: entries };
}

function tableRow(values: readonly (PlainText | number | null)[]): RichCardTableRow {
  return {
    type: "TableRow",
    cells: values.map((value) => ({
      type: "TableCell",
      items: [{ type: "TextBlock", text: value === null ? "—" : String(value), wrap: true }],
    })),
  };
}

function barChartFacts(result: ChartResult): readonly { readonly title: string; readonly value: string }[] {
  const maxMagnitude = Math.max(
    ...result.series.flatMap((series) => series.points.map((point) => Math.abs(point.value))),
  );
  return result.series.flatMap((series) =>
    series.points.map((point) => {
      const width = point.value === 0 ? 0 : Math.max(1, Math.round((Math.abs(point.value) / maxMagnitude) * 10));
      const bar = `${point.value < 0 ? "−" : ""}${"█".repeat(width)}`;
      return {
        title: `${series.name} · ${point.label}`,
        value: bar ? `${bar} ${Math.abs(point.value)}` : "0",
      };
    }),
  );
}

function lineChartFacts(result: ChartResult): readonly { readonly title: string; readonly value: string }[] {
  const glyphs = "▁▂▃▄▅▆▇█";
  return result.series.map((series) => {
    const values = series.points.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const scale = Math.max(Math.abs(min), Math.abs(max), 1);
    const range = max / scale - min / scale;
    const line = values
      .map(
        (value) => glyphs[range === 0 ? 3 : Math.round(((value / scale - min / scale) / range) * (glyphs.length - 1))],
      )
      .join("");
    return {
      title: series.name,
      value: `${line} · ${series.points.map((point) => `${point.label} ${point.value}`).join(", ")}`,
    };
  });
}

function cardFor(result: RichResult): RichResultAdaptiveCard {
  const base = {
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json" as const,
    type: "AdaptiveCard" as const,
    version: "1.5" as const,
  };
  switch (result.kind) {
    case "status": {
      const color = { healthy: "Good", warning: "Warning", failed: "Attention", unknown: "Accent" }[result.state] as
        "Good" | "Warning" | "Attention" | "Accent";
      return {
        ...base,
        body: [
          title(result.title),
          { type: "TextBlock", text: result.summary, wrap: true, color },
          facts([
            { title: "Status", value: result.state },
            ...result.facts.map((fact) => ({ title: fact.label, value: fact.value })),
          ]),
        ],
        actions: [],
      };
    }
    case "table":
      return {
        ...base,
        body: [
          title(result.title),
          {
            type: "Table",
            firstRowAsHeaders: true,
            showGridLines: true,
            columns: result.columns.map(() => ({ width: 1 as const })),
            rows: [tableRow(result.columns), ...result.rows.map(tableRow)],
          },
        ],
        actions: [],
      };
    case "chart":
      return {
        ...base,
        body: [
          title(result.title),
          { type: "TextBlock", text: `${result.chartType === "bar" ? "Bar" : "Line"} chart`, wrap: true },
          // Adaptive Card 1.5 has no native chart element. Glyphs keep the view deterministic while the numeric evidence remains visible.
          facts(result.chartType === "bar" ? barChartFacts(result) : lineChartFacts(result)),
        ],
        actions: [],
      };
    case "incident":
      return {
        ...base,
        body: [
          title(result.title),
          { type: "TextBlock", text: result.summary, wrap: true, color: "Attention" },
          facts([
            { title: "Severity", value: result.severity },
            { title: "Status", value: result.status },
          ]),
        ],
        actions: [{ type: "Action.OpenUrl", title: "Open incident", url: result.url }],
      };
    case "pull_request":
      return {
        ...base,
        body: [
          title(result.title),
          facts([
            { title: "Repository", value: result.repository },
            { title: "Pull request", value: `#${result.number}` },
            { title: "State", value: result.state },
            { title: "Author", value: result.author },
          ]),
        ],
        actions: [{ type: "Action.OpenUrl", title: "Open pull request", url: result.url }],
      };
    case "sources":
      return {
        ...base,
        body: [
          title(result.title),
          facts(
            result.sources.map((source, index) => ({
              title: `Source ${index + 1}`,
              value: `${source.label} · ${source.sourceId} · ${source.version}`,
            })),
          ),
        ],
        actions: result.sources.map((source) => ({ type: "Action.OpenUrl", title: source.label, url: source.url })),
      };
  }
}

export function renderRichResultCard(result: RichResult): RichResultAdaptiveCard {
  const card = cardFor(parseRichResult(result));
  const bytes = new TextEncoder().encode(JSON.stringify(card)).byteLength;
  if (bytes > MAX_RICH_RESULT_CARD_BYTES) {
    throw new RangeError(`Rich result card exceeds ${MAX_RICH_RESULT_CARD_BYTES} bytes`);
  }
  return card;
}
