/**
 * packages/shared/src/reporting/metricDisplayNames.ts
 *
 * 根拠: PrjOps:REQ-019 / PrjOps:SPEC-INT-051 / PrjOps:AC-019-1。
 */
export const METRIC_DISPLAY_NAMES_VERSION = "metric-display-names.v1";

export interface MetricDisplayDefinition {
  publicId: string;
  displayName: Readonly<Record<"ja" | "en", string>>;
}

const DEFINITIONS = {
  blocked: { publicId: "MTR-BLOCKED", displayName: { ja: "ブロック件数", en: "Blocked" } },
  completed: { publicId: "MTR-COMPLETED", displayName: { ja: "完了件数", en: "Completed" } },
} as const satisfies Record<string, MetricDisplayDefinition>;

const BY_PUBLIC_ID = new Map<string, string>(Object.entries(DEFINITIONS).map(([key, value]) => [value.publicId, key]));

export function metricDisplayDefinition(key: string): MetricDisplayDefinition | undefined {
  return Object.prototype.hasOwnProperty.call(DEFINITIONS, key)
    ? DEFINITIONS[key as keyof typeof DEFINITIONS]
    : undefined;
}

export function metricKeyForPublicId(publicId: string): string | undefined {
  return BY_PUBLIC_ID.get(publicId);
}

export function undefinedMetricDisplayKeys(keys: Iterable<string>): string[] {
  return [...keys].filter((key) => metricDisplayDefinition(key) === undefined).sort();
}
