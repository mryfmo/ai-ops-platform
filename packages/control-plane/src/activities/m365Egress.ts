// 根拠: FinalArch:PRD-007 / FinalArch:WIQ-004 / ADR-0024
import type { OpaDecisionClient } from "@aiops/policy";

import {
  buildM365EgressPolicyInput,
  prepareM365Egress,
  type M365EgressErrorCode,
  type M365EgressRequest,
  type M365ExternalProvider,
} from "../lib/m365Egress.js";

export interface M365LlmInput {
  readonly provider: M365ExternalProvider;
  readonly content: string;
}

export interface M365EgressDependencies {
  readonly decisionClient: Pick<OpaDecisionClient, "decide">;
  readonly dispatch: (input: M365LlmInput) => Promise<void>;
}

export type M365EgressResult =
  | {
      readonly status: "dispatched";
      readonly provider: M365ExternalProvider;
      readonly policyBundleVersion: string;
      readonly decisionId?: string;
    }
  | { readonly status: "blocked"; readonly code: M365EgressErrorCode };

export async function routeM365Output(
  request: M365EgressRequest,
  dependencies: M365EgressDependencies,
): Promise<M365EgressResult> {
  let input: ReturnType<typeof buildM365EgressPolicyInput>;
  try {
    input = buildM365EgressPolicyInput(request);
  } catch {
    return { status: "blocked", code: "E-M365-EGRESS-INPUT" };
  }
  if (!input) return { status: "blocked", code: "E-M365-EGRESS-INPUT" };

  let decision;
  try {
    decision = await dependencies.decisionClient.decide(input);
  } catch {
    return { status: "blocked", code: "E-M365-EGRESS-POLICY" };
  }
  if (
    input.resource.classification === "restricted" ||
    decision.decision !== "allow" ||
    decision.errorCode !== undefined
  ) {
    return { status: "blocked", code: "E-M365-EGRESS-POLICY" };
  }

  const prepared = prepareM365Egress(request, input, decision);
  if (!prepared.ok) return { status: "blocked", code: prepared.code };
  try {
    await dependencies.dispatch({ provider: prepared.provider, content: prepared.content });
  } catch {
    return { status: "blocked", code: "E-M365-EGRESS-DISPATCH" };
  }
  return {
    status: "dispatched",
    provider: prepared.provider,
    policyBundleVersion: decision.policyBundleVersion,
    ...(decision.decisionId === undefined ? {} : { decisionId: decision.decisionId }),
  };
}

export type { M365EgressRequest } from "../lib/m365Egress.js";
