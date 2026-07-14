/**
 * packages/prjops/src/lib/masterValidation.ts
 *
 * 根拠:
 *   - PrjOps:REQ-001 プロジェクトマスタ: 名称、担当リーダー(PRF-02)、担当マネージャー(PRF-03)、参加企業ID一覧、
 *     開始日、終了予定日、報告頻度（週次固定）、状態(active/suspended/closed)。
 *     AC-001-1: 属性が1つでも欠けたプロジェクト登録はエラーになり、欠落属性名がエラーメッセージに含まれる。
 *   - PrjOps:REQ-002 関係者・企業マスタ（SPEC-INT-022 stakeholder / SPEC-INT-023 organization）:
 *     氏名、所属企業ID、プロファイル(PRF-01〜05)、メールアドレス、TeamsユーザーID(任意)、
 *     優先言語(ja/en)、タイムゾーン。企業は国内/海外区分を持つ。
 *     AC-002-1: 1人の関係者は複数プロジェクトに異なる立場で参加できる。
 *
 * 設計方針: zodのような外部バリデーションライブラリに頼らず、依存ゼロの手書き検証関数として実装する。
 * これによりAC-001-1が要求する「欠落属性名を含むエラーメッセージ」を確実に、かつ外部ライブラリの
 * エラー整形仕様に依存せず保証できる（本パッケージにはzod依存もあるが、YAML読み込み層の型付けに
 * 用いるのみで、AC検証そのものは本モジュールが担う）。
 */

export interface ProjectInput {
  id?: string;
  name?: string;
  leader_id?: string; // PRF-02
  manager_id?: string; // PRF-03
  organization_ids?: string[];
  start_date?: string;
  end_date?: string;
  report_frequency?: string; // 週次固定
  status?: string; // active|suspended|closed
}

const REQUIRED_PROJECT_FIELDS: Array<keyof ProjectInput> = [
  "id",
  "name",
  "leader_id",
  "manager_id",
  "organization_ids",
  "start_date",
  "end_date",
  "report_frequency",
  "status",
];

export interface ValidationResult {
  ok: boolean;
  missingFields: string[];
  errors: string[];
}

function isEmpty(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim().length === 0;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/** PrjOps:REQ-001 AC-001-1: 欠落属性を検出し、属性名を含むエラーメッセージを返す */
export function validateProject(input: ProjectInput): ValidationResult {
  const missingFields = REQUIRED_PROJECT_FIELDS.filter((f) => isEmpty(input[f]));
  const errors: string[] = [];
  if (missingFields.length > 0) {
    errors.push(`E-MST01: プロジェクト登録エラー: 以下の属性が欠落しています: ${missingFields.join(", ")}`);
  }
  const validStatuses = new Set(["active", "suspended", "closed"]);
  if (input.status && !validStatuses.has(input.status)) {
    errors.push(`E-MST02: statusは active|suspended|closed のいずれかである必要があります（実際: ${input.status}）`);
  }
  if (input.report_frequency && input.report_frequency !== "weekly") {
    errors.push(
      `E-MST03: report_frequencyは週次固定（"weekly"）である必要があります（実際: ${input.report_frequency}）`,
    );
  }
  if (input.start_date && input.end_date && input.start_date > input.end_date) {
    errors.push(`E-MST04: start_date(${input.start_date})はend_date(${input.end_date})より前である必要があります`);
  }
  return { ok: errors.length === 0, missingFields, errors };
}

export interface StakeholderAssignment {
  project_id: string;
  profile: "PRF-01" | "PRF-02" | "PRF-03" | "PRF-04" | "PRF-05";
}

export interface StakeholderInput {
  id?: string;
  name?: string;
  organization_id?: string;
  assignments?: StakeholderAssignment[];
  email?: string;
  teams_user_id?: string | null;
  preferred_language?: "ja" | "en";
  timezone?: string;
}

const REQUIRED_STAKEHOLDER_FIELDS: Array<keyof StakeholderInput> = [
  "id",
  "name",
  "organization_id",
  "assignments",
  "email",
  "preferred_language",
  "timezone",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** PrjOps:REQ-002: 関係者マスタ検証。AC-002-1: 複数プロジェクトに異なる立場で参加できることを許容する（重複禁止はしない） */
export function validateStakeholder(input: StakeholderInput): ValidationResult {
  const missingFields = REQUIRED_STAKEHOLDER_FIELDS.filter((f) => isEmpty(input[f]));
  const errors: string[] = [];
  if (missingFields.length > 0) {
    errors.push(`E-MST05: 関係者登録エラー: 以下の属性が欠落しています: ${missingFields.join(", ")}`);
  }
  if (input.email && !EMAIL_RE.test(input.email)) {
    errors.push(`E-MST06: emailの形式が不正です（実際: ${input.email}）`);
  }
  if (input.assignments) {
    for (const a of input.assignments) {
      if (!/^PRF-0[1-5]$/.test(a.profile)) {
        errors.push(`E-MST07: assignmentsのprofileはPRF-01〜05のいずれかである必要があります（実際: ${a.profile}）`);
      }
    }
  }
  return { ok: errors.length === 0, missingFields, errors };
}

export interface OrganizationInput {
  id?: string;
  name?: string;
  country?: string; // ISO 3166-1 alpha-2
  domestic_or_overseas?: "domestic" | "overseas";
}

const REQUIRED_ORG_FIELDS: Array<keyof OrganizationInput> = ["id", "name", "country", "domestic_or_overseas"];

export function validateOrganization(input: OrganizationInput): ValidationResult {
  const missingFields = REQUIRED_ORG_FIELDS.filter((f) => isEmpty(input[f]));
  const errors: string[] = [];
  if (missingFields.length > 0) {
    errors.push(`E-MST08: 企業登録エラー: 以下の属性が欠落しています: ${missingFields.join(", ")}`);
  }
  return { ok: errors.length === 0, missingFields, errors };
}
