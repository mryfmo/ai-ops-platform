/**
 * packages/server/src/lib/stakeholderProfileResolver.ts
 *
 * 根拠: ADR-0005 / PrjOps:REQ-002（Teams発話者を関係者マスタのteams_user_idとproject assignmentへ突合する）。
 */
import { validateStakeholder, type Profile, type StakeholderInput } from "@aiops/prjops";

export interface CallerProfileResolution {
  profile: Profile | null;
  reason: "matched" | "missing_author_aad_id" | "stakeholder_not_found" | "project_assignment_not_found";
}

export function resolveCallerProfileFromStakeholders(
  stakeholders: StakeholderInput[],
  authorAadId: string | null,
  projectId: string,
): CallerProfileResolution {
  if (!authorAadId) return { profile: null, reason: "missing_author_aad_id" };

  for (const stakeholder of stakeholders) {
    if (!validateStakeholder(stakeholder).ok) continue;
    if (stakeholder.teams_user_id !== authorAadId) continue;

    const assignment = stakeholder.assignments?.find((a) => a.project_id === projectId);
    return assignment
      ? { profile: assignment.profile, reason: "matched" }
      : { profile: null, reason: "project_assignment_not_found" };
  }

  return { profile: null, reason: "stakeholder_not_found" };
}
