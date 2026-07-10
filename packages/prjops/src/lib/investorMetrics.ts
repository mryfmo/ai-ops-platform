/**
 * packages/prjops/src/lib/investorMetrics.ts
 *
 * 根拠: REQ-039 / SPEC-INT-066 / AC-039-1 / ADR-0011。
 * ILPA Portfolio Company Metrics Template 2019を暫定ベースに、定義テーブルで投資家KPIを扱う。
 */

export type InvestorMetricKind = "financial-input" | "github-derived";

export interface InvestorMetricDefinition {
  id: string;
  label: string;
  unit: string;
  cadence: "monthly" | "quarterly";
  kind: InvestorMetricKind;
  version: string;
  effectiveFrom: string;
  required: boolean;
  compute: (companies: InvestorPortfolioCompanyInput[], financialInputs: InvestorFinancialInputs) => number | null;
}

export const INVESTOR_METRIC_DEFINITIONS: InvestorMetricDefinition[] = [
  {
    id: "revenue",
    label: "Revenue",
    unit: "currency",
    cadence: "quarterly",
    kind: "financial-input",
    version: "ILPA-2019",
    effectiveFrom: "2019-01-01",
    required: true,
    compute: (companies, financialInputs) =>
      financialInputs["revenue"] ?? weightedSum(companies.map((company) => [company.revenue, company.ownershipPct])),
  },
  {
    id: "ebitda",
    label: "EBITDA",
    unit: "currency",
    cadence: "quarterly",
    kind: "financial-input",
    version: "ILPA-2019",
    effectiveFrom: "2019-01-01",
    required: false,
    compute: (companies, financialInputs) =>
      financialInputs["ebitda"] ?? weightedSum(companies.map((company) => [company.ebitda, company.ownershipPct])),
  },
];

export type InvestorFinancialInputs = Record<string, number | undefined>;

export interface InvestorMetricTargetInputs {
  targets?: Record<string, number | undefined>;
  trends?: Record<string, number[] | undefined>;
}

export interface InvestorPortfolioCompanyInput {
  projectId: string;
  name: string;
  ownershipPct?: number;
  revenue?: number;
  ebitda?: number;
  milestoneDelayDays: number;
  highSeverityOpenIssueCount: number;
}

export interface InvestorMetricValue {
  metricId: string;
  label: string;
  unit: string;
  value: number | null;
  target: number | null;
  variance: number | null;
  trend: number[];
  source: InvestorMetricKind;
}

export interface InvestorReport {
  highlights: string[];
  kpis: InvestorMetricValue[];
  milestones: Array<{ projectId: string; name: string; delayDays: number }>;
  risks: Array<{ projectId: string; name: string; highSeverityOpenIssueCount: number }>;
}

function weightedSum(values: Array<[number | undefined, number | undefined]>): number | null {
  const present = values.filter((value): value is [number, number | undefined] => typeof value[0] === "number");
  return present.length === 0
    ? null
    : present.reduce((acc, [value, ownershipPct]) => acc + value * ((ownershipPct ?? 100) / 100), 0);
}

export function buildInvestorReport(
  companies: InvestorPortfolioCompanyInput[],
  financialInputs: InvestorFinancialInputs = {},
  boardPack: InvestorMetricTargetInputs = {},
): InvestorReport {
  return {
    highlights: [
      `${companies.length} portfolio companies`,
      `${companies.filter((company) => company.highSeverityOpenIssueCount > 0).length} companies with high severity risks`,
    ],
    kpis: INVESTOR_METRIC_DEFINITIONS.map((definition) => {
      const value = definition.compute(companies, financialInputs);
      const target = boardPack.targets?.[definition.id] ?? null;
      return {
        metricId: definition.id,
        label: definition.label,
        unit: definition.unit,
        value,
        target,
        variance: value === null || target === null ? null : value - target,
        trend: boardPack.trends?.[definition.id] ?? [],
        source: definition.kind,
      };
    }),
    milestones: companies.map((company) => ({
      projectId: company.projectId,
      name: company.name,
      delayDays: company.milestoneDelayDays,
    })),
    risks: companies
      .filter((company) => company.highSeverityOpenIssueCount > 0)
      .map((company) => ({
        projectId: company.projectId,
        name: company.name,
        highSeverityOpenIssueCount: company.highSeverityOpenIssueCount,
      })),
  };
}
