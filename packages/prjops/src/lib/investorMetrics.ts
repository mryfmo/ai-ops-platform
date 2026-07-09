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
  version: "ILPA-2019";
  effectiveFrom: string;
  required: boolean;
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
  },
  {
    id: "milestone_delay_days",
    label: "Milestone delay days",
    unit: "days",
    cadence: "monthly",
    kind: "github-derived",
    version: "ILPA-2019",
    effectiveFrom: "2019-01-01",
    required: false,
  },
  {
    id: "high_severity_open_issues",
    label: "High severity open issues",
    unit: "count",
    cadence: "monthly",
    kind: "github-derived",
    version: "ILPA-2019",
    effectiveFrom: "2019-01-01",
    required: false,
  },
];

export type InvestorFinancialInputs = Record<string, number | undefined>;

export interface InvestorPortfolioCompanyInput {
  projectId: string;
  name: string;
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
  source: InvestorMetricKind;
}

export interface InvestorReport {
  highlights: string[];
  kpis: InvestorMetricValue[];
  milestones: Array<{ projectId: string; name: string; delayDays: number }>;
  risks: Array<{ projectId: string; name: string; highSeverityOpenIssueCount: number }>;
}

function sum(values: Array<number | undefined>): number | null {
  const present = values.filter((value): value is number => typeof value === "number");
  return present.length === 0 ? null : present.reduce((acc, value) => acc + value, 0);
}

export function buildInvestorReport(
  companies: InvestorPortfolioCompanyInput[],
  financialInputs: InvestorFinancialInputs = {},
): InvestorReport {
  const metrics = new Map<string, number | null>([
    ["revenue", financialInputs["revenue"] ?? sum(companies.map((company) => company.revenue))],
    ["ebitda", financialInputs["ebitda"] ?? sum(companies.map((company) => company.ebitda))],
    ["milestone_delay_days", companies.reduce((acc, company) => acc + company.milestoneDelayDays, 0)],
    ["high_severity_open_issues", companies.reduce((acc, company) => acc + company.highSeverityOpenIssueCount, 0)],
  ]);

  return {
    highlights: [
      `${companies.length} portfolio companies`,
      `${companies.filter((company) => company.highSeverityOpenIssueCount > 0).length} companies with high severity risks`,
    ],
    kpis: INVESTOR_METRIC_DEFINITIONS.map((definition) => ({
      metricId: definition.id,
      label: definition.label,
      unit: definition.unit,
      value: metrics.get(definition.id) ?? null,
      source: definition.kind,
    })),
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
