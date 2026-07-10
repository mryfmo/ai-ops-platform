/**
 * packages/prjops/src/lib/executiveSevenKeys.ts
 *
 * 根拠: REQ-038 / SPEC-INT-065 / AC-038-1 / ADR-0010。
 * Seven Keys to Success正典に合わせ、プロジェクト毎 x 7キー毎のRAGを決定的に算出する。
 * GitHub由来で観測不能な定性キーは推測せずgreyにする。
 */

export type SevenKeysRag = "green" | "yellow" | "red" | "grey";
export type SevenKeyId = "K1" | "K2" | "K3" | "K4" | "K5" | "K6" | "K7";

export interface SevenKeyDefinition {
  id: SevenKeyId;
  title: string;
  source: "questionnaire" | "github" | "hybrid";
}

export const SEVEN_KEY_DEFINITIONS: SevenKeyDefinition[] = [
  { id: "K1", title: "Stakeholders are committed", source: "questionnaire" },
  { id: "K2", title: "Business benefits are realized", source: "questionnaire" },
  { id: "K3", title: "Work and schedule are predictable", source: "github" },
  { id: "K4", title: "Scope is realistic and managed", source: "github" },
  { id: "K5", title: "Team is high performing", source: "github" },
  { id: "K6", title: "Risks are mitigated", source: "hybrid" },
  { id: "K7", title: "Delivery organization benefits are realized", source: "questionnaire" },
];

export interface SevenKeysQuestionnaireInput {
  stakeholdersCommitted?: SevenKeysRag;
  businessBenefits?: SevenKeysRag;
  riskMitigation?: SevenKeysRag;
  deliveryOrgBenefits?: SevenKeysRag;
}

export interface SevenKeysQuestionnaireRecord {
  projectId: string;
  month: string;
  answers: SevenKeysQuestionnaireInput;
}

export interface ExecutiveProjectInput {
  projectId: string;
  name?: string;
  progressPct: number;
  startDate?: string;
  endDate?: string;
  asOfDate?: string;
  highSeverityOpenIssueCount: number;
  isOverdue: boolean;
  scopeChangeCount?: number;
  averageReviewWaitHours?: number;
  activeContributorCount?: number;
  questionnaire?: SevenKeysQuestionnaireInput;
}

export interface SevenKeyAssessment {
  keyId: SevenKeyId;
  title: string;
  rag: SevenKeysRag;
  basis: string;
}

export interface ExecutiveProjectSevenKeys {
  projectId: string;
  name: string;
  keys: SevenKeyAssessment[];
}

export interface SevenKeysMonthlySnapshot extends ExecutiveProjectSevenKeys {
  month: string;
  improvedKeys: SevenKeyId[];
  worsenedKeys: SevenKeyId[];
}

export interface ExecutiveSevenKeysSummary {
  projects: ExecutiveProjectSevenKeys[];
}

const RANK: Record<Exclude<SevenKeysRag, "grey">, number> = { red: 0, yellow: 1, green: 2 };
// ADR-0010: GitHub由来RAGの初期校正値。運用実績で見直す前提で、正典キー名とは分離する。
const WORK_PREDICTABILITY_TOLERANCE_PCT = 10;
const SCOPE_RED_CHANGE_COUNT = 5;
const SCOPE_YELLOW_CHANGE_COUNT = 2;
const TEAM_RED_MIN_ACTIVE_CONTRIBUTORS = 1;
const TEAM_RED_REVIEW_WAIT_HOURS = 72;
const TEAM_YELLOW_REVIEW_WAIT_HOURS = 48;

function q(value: SevenKeysRag | undefined, missing: string): { rag: SevenKeysRag; basis: string } {
  return value ? { rag: value, basis: "questionnaire" } : { rag: "grey", basis: missing };
}

export function applySevenKeysQuestionnaire(
  project: ExecutiveProjectInput,
  questionnaires: SevenKeysQuestionnaireRecord[],
  month: string,
): ExecutiveProjectInput {
  const record = questionnaires.find((q) => q.projectId === project.projectId && q.month === month);
  return record ? { ...project, questionnaire: record.answers } : project;
}

function expectedProgressPct(p: ExecutiveProjectInput): number | null {
  if (!p.startDate || !p.endDate || !p.asOfDate) return null;
  const start = Date.parse(p.startDate);
  const end = Date.parse(p.endDate);
  const asOf = Date.parse(p.asOfDate);
  if (!(end > start)) return null;
  return Math.min(100, Math.max(0, ((asOf - start) / (end - start)) * 100));
}

function workAndSchedule(p: ExecutiveProjectInput): SevenKeysRag {
  if (p.isOverdue) return "red";
  const expected = expectedProgressPct(p);
  if (expected === null) return p.progressPct < 70 ? "yellow" : "green";
  if (p.progressPct + WORK_PREDICTABILITY_TOLERANCE_PCT < expected) return "yellow";
  return "green";
}

function scopeManaged(p: ExecutiveProjectInput): SevenKeysRag {
  if (p.scopeChangeCount == null) return "grey";
  if (p.scopeChangeCount >= SCOPE_RED_CHANGE_COUNT) return "red";
  if (p.scopeChangeCount >= SCOPE_YELLOW_CHANGE_COUNT) return "yellow";
  return "green";
}

function teamPerformance(p: ExecutiveProjectInput): SevenKeysRag {
  if (p.averageReviewWaitHours == null || p.activeContributorCount == null) return "grey";
  if (
    p.activeContributorCount <= TEAM_RED_MIN_ACTIVE_CONTRIBUTORS ||
    p.averageReviewWaitHours >= TEAM_RED_REVIEW_WAIT_HOURS
  )
    return "red";
  if (p.averageReviewWaitHours >= TEAM_YELLOW_REVIEW_WAIT_HOURS) return "yellow";
  return "green";
}

function risksMitigated(p: ExecutiveProjectInput): SevenKeysRag {
  if (p.highSeverityOpenIssueCount > 0) return "red";
  return p.questionnaire?.riskMitigation ?? "grey";
}

export function assessProjectSevenKeys(project: ExecutiveProjectInput): ExecutiveProjectSevenKeys {
  const questionnaire = project.questionnaire ?? {};
  const qualitativeMissing = "structured questionnaire missing";
  const values: Record<SevenKeyId, { rag: SevenKeysRag; basis: string }> = {
    K1: q(questionnaire.stakeholdersCommitted, qualitativeMissing),
    K2: q(questionnaire.businessBenefits, qualitativeMissing),
    K3: { rag: workAndSchedule(project), basis: "progress vs elapsed schedule/isOverdue" },
    K4: {
      rag: scopeManaged(project),
      basis: project.scopeChangeCount == null ? "scope change data missing" : "scopeChangeCount",
    },
    K5: {
      rag: teamPerformance(project),
      basis:
        project.averageReviewWaitHours == null || project.activeContributorCount == null
          ? "review/contributor data missing"
          : "review wait/contributors",
    },
    K6: {
      rag: risksMitigated(project),
      basis: project.highSeverityOpenIssueCount > 0 ? "high severity open issues" : "risk questionnaire",
    },
    K7: q(questionnaire.deliveryOrgBenefits, qualitativeMissing),
  };

  return {
    projectId: project.projectId,
    name: project.name ?? project.projectId,
    keys: SEVEN_KEY_DEFINITIONS.map((definition) => ({
      keyId: definition.id,
      title: definition.title,
      ...values[definition.id],
    })),
  };
}

export function computeExecutiveSevenKeys(projects: ExecutiveProjectInput[]): ExecutiveSevenKeysSummary {
  return { projects: projects.map(assessProjectSevenKeys) };
}

export function buildSevenKeysMonthlySnapshot(
  project: ExecutiveProjectInput,
  month: string,
  previous?: ExecutiveProjectSevenKeys,
): SevenKeysMonthlySnapshot {
  const current = assessProjectSevenKeys(project);
  const previousByKey = new Map(previous?.keys.map((key) => [key.keyId, key.rag]) ?? []);
  const improvedKeys: SevenKeyId[] = [];
  const worsenedKeys: SevenKeyId[] = [];
  for (const key of current.keys) {
    const prev = previousByKey.get(key.keyId);
    if (!prev) continue;
    if (prev === "grey" || key.rag === "grey") continue;
    if (RANK[key.rag] > RANK[prev]) improvedKeys.push(key.keyId);
    if (RANK[key.rag] < RANK[prev]) worsenedKeys.push(key.keyId);
  }
  return { ...current, month, improvedKeys, worsenedKeys };
}
