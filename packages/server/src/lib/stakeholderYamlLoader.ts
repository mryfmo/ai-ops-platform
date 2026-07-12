/**
 * packages/server/src/lib/stakeholderYamlLoader.ts
 *
 * 根拠: REQ-002 / AUD-IMP-003（関係者マスタを設定済みYAMLディレクトリから読み込む）。
 */
import { join } from "node:path";
import { validateStakeholder, type Profile, type StakeholderInput } from "@aiops/prjops";
import { z } from "zod";
import { resolveCallerProfileFromStakeholders } from "./stakeholderProfileResolver.js";

const stakeholderSchema = z
  .object({
    id: z.string().regex(/^ST-\d{3,}$/),
    name: z.string().min(1),
    organization_id: z.string().regex(/^ORG-\d{3,}$/),
    assignments: z.array(
      z
        .object({
          project_id: z.string().regex(/^PJ-\d{3,}$/),
          profile: z.enum(["PRF-01", "PRF-02", "PRF-03", "PRF-04", "PRF-05"]),
        })
        .strict(),
    ),
    email: z.string().email(),
    teams_user_id: z.string().min(1).nullable().optional(),
    preferred_language: z.enum(["ja", "en"]),
    timezone: z.string().min(1),
    created_at: z.string().datetime({ offset: true }).optional(),
    updated_at: z.string().datetime({ offset: true }).optional(),
    updated_by: z
      .string()
      .regex(/^ST-\d{3,}$/)
      .optional(),
  })
  .strict();

export interface StakeholderYamlFs {
  readdirSync(directory: string): string[];
  readFileSync(path: string, encoding: "utf8"): string;
}

export function loadStakeholdersFromYamlDirectory(
  directory: string,
  fs: StakeholderYamlFs,
  parseYaml: (source: string) => unknown,
): StakeholderInput[] {
  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".yaml"))
    .sort()
    .map((file) => {
      const parsed = parseYaml(fs.readFileSync(join(directory, file), "utf8"));
      const shape = stakeholderSchema.safeParse(parsed);
      if (!shape.success) throw new Error(`${file}: invalid stakeholder schema: ${shape.error.message}`);
      const stakeholder: StakeholderInput = shape.data;
      const validation = validateStakeholder(stakeholder);
      if (!validation.ok) throw new Error(`${file}: ${validation.errors.join("; ")}`);
      return stakeholder;
    });
}

export interface StakeholderMasterDecision {
  resolveCallerProfile(authorAadId: string | null, projectId: string): Profile | null;
  auditIntent: {
    actor: "SERVER";
    action: "stakeholder_master_not_configured";
    basis: "REQ-002 AUD-IMP-003";
    detail: { reason: "STAKEHOLDERS_DIR is not configured" };
  } | null;
}

export function decideStakeholderMaster(stakeholders: StakeholderInput[] | null): StakeholderMasterDecision {
  if (stakeholders) {
    return {
      resolveCallerProfile: (authorAadId, projectId) =>
        resolveCallerProfileFromStakeholders(stakeholders, authorAadId, projectId).profile,
      auditIntent: null,
    };
  }
  return {
    resolveCallerProfile: () => null,
    auditIntent: {
      actor: "SERVER",
      action: "stakeholder_master_not_configured",
      basis: "REQ-002 AUD-IMP-003",
      detail: { reason: "STAKEHOLDERS_DIR is not configured" },
    },
  };
}
