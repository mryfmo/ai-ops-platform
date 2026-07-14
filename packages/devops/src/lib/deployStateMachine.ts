/**
 * packages/devops/src/lib/deployStateMachine.ts
 *
 * 根拠: DevOps:SPEC-INT-020 AGT-DEP デプロイ状態機械
 *   pending → staging_deployed →（承認要求）approval_requested → approved → prod_deploying → monitoring → stable
 *   分岐: approval_requested → rejected | expired（TH-002）、monitoring → rolling_back → rolled_back（TH-003）
 *   「これ以外の遷移を実装してはならない」と明記されているため、許可リストを厳格に定義する。
 */

export type DeployState =
  | "pending"
  | "staging_deployed"
  | "approval_requested"
  | "approved"
  | "rejected"
  | "expired"
  | "prod_deploying"
  | "monitoring"
  | "stable"
  | "rolling_back"
  | "rolled_back";

const TRANSITIONS: Record<DeployState, DeployState[]> = {
  pending: ["staging_deployed"],
  staging_deployed: ["approval_requested"],
  approval_requested: ["approved", "rejected", "expired"],
  approved: ["prod_deploying"],
  rejected: [],
  expired: [],
  prod_deploying: ["monitoring"],
  monitoring: ["stable", "rolling_back"],
  stable: [],
  rolling_back: ["rolled_back"],
  rolled_back: [],
};

export class InvalidDeployTransitionError extends Error {
  constructor(from: DeployState, to: DeployState) {
    super(
      `E-DEP02: invalid deployment transition ${from} -> ${to} (DevOps:SPEC-INT-020: これ以外の遷移を実装してはならない)`,
    );
  }
}

export function canTransitionDeploy(from: DeployState, to: DeployState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertDeployTransition(from: DeployState, to: DeployState): void {
  if (!canTransitionDeploy(from, to)) {
    throw new InvalidDeployTransitionError(from, to);
  }
}

/** AC-010a: 承認なしで本番デプロイが実行される経路が存在しないことの機械検証用ヘルパ */
export function reachesProdDeployingWithoutApproval(transitionLog: DeployState[]): boolean {
  const prodIndex = transitionLog.indexOf("prod_deploying");
  if (prodIndex === -1) return false;
  const approvedIndex = transitionLog.indexOf("approved");
  return approvedIndex === -1 || approvedIndex > prodIndex;
}
