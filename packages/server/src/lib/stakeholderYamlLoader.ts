/**
 * packages/server/src/lib/stakeholderYamlLoader.ts
 *
 * 根拠: PrjOps:REQ-002 / AUD-IMP-003（hardened関係者マスタをTeams認可へ結線する）。
 */
import type { Profile, YamlStakeholderMasterProvider } from "@aiops/prjops";

type TeamsProfileProvider = Pick<YamlStakeholderMasterProvider, "findProfileByTeamsUserId">;

export interface StakeholderMasterDecision {
  resolveCallerProfile(authorAadId: string | null, projectId: string): Profile | null | Promise<Profile | null>;
  auditIntent: {
    actor: "SERVER";
    action: "stakeholder_master_not_configured";
    basis: "PrjOps:REQ-002 AUD-IMP-003";
    detail: { reason: "STAKEHOLDERS_DIR is not configured" };
  } | null;
}

export function decideStakeholderMaster(provider: TeamsProfileProvider | null): StakeholderMasterDecision {
  if (provider) {
    return {
      resolveCallerProfile: (authorAadId, projectId) => provider.findProfileByTeamsUserId(authorAadId, projectId),
      auditIntent: null,
    };
  }
  return {
    resolveCallerProfile: () => null,
    auditIntent: {
      actor: "SERVER",
      action: "stakeholder_master_not_configured",
      basis: "PrjOps:REQ-002 AUD-IMP-003",
      detail: { reason: "STAKEHOLDERS_DIR is not configured" },
    },
  };
}
