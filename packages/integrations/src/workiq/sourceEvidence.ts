// 根拠: ADR-0024 / WIQ-001 / WIQ-002 / WIQ-005
import type { WorkIqClientErrorCode, WorkIqRestClient, WorkIqSourceReference } from "./restClient.js";
import type { ValidatedWorkIqDelegatedClaims } from "./tokenClaims.js";

export type WorkIqSourceFetchClient = Pick<WorkIqRestClient, "fetch">;
export type WorkIqSourceReferenceResolver = (reference: WorkIqSourceReference) => string | undefined;
export type WorkIqAccessibilityErrorCode = WorkIqClientErrorCode | "E-WIQ-REF-UNRESOLVED" | "E-WIQ-REF-IDENTITY";

export interface WorkIqSourceAccessibilityEvidence {
  readonly referenceIndex: number;
  readonly accessible: boolean;
  readonly errorCode?: WorkIqAccessibilityErrorCode;
}

export interface WorkIqSourceAccessibilityResult {
  readonly allAccessible: boolean;
  readonly evidence: readonly WorkIqSourceAccessibilityEvidence[];
}

export interface WorkIqProbeSubject {
  readonly expectedIdentity: ValidatedWorkIqDelegatedClaims;
  readonly client: WorkIqSourceFetchClient;
}

export interface WorkIqSourceAccessibilityInput extends WorkIqProbeSubject {
  readonly sourceReferences: readonly WorkIqSourceReference[];
  readonly resolveReference: WorkIqSourceReferenceResolver;
}

export interface WorkIqPermissionDifferentialInput {
  readonly sourceReferences: readonly WorkIqSourceReference[];
  readonly owner: WorkIqProbeSubject;
  readonly comparison: WorkIqProbeSubject;
  readonly resolveReference: WorkIqSourceReferenceResolver;
}

export interface WorkIqPermissionDifferentialResult {
  readonly passed: boolean;
  readonly owner: WorkIqSourceAccessibilityResult;
  readonly comparison: WorkIqSourceAccessibilityResult;
}

const MAX_SOURCE_REFERENCES = 32;

function validIdentity(identity: ValidatedWorkIqDelegatedClaims): boolean {
  return identity.tenantId.trim() !== "" && identity.subject.trim() !== "";
}

function assertProbeInput(input: WorkIqSourceAccessibilityInput): void {
  if (
    !Array.isArray(input.sourceReferences) ||
    input.sourceReferences.length < 1 ||
    input.sourceReferences.length > MAX_SOURCE_REFERENCES ||
    input.sourceReferences.some(
      (reference) =>
        reference === null ||
        typeof reference !== "object" ||
        Array.isArray(reference) ||
        Object.keys(reference).length < 1,
    ) ||
    !validIdentity(input.expectedIdentity) ||
    typeof input.resolveReference !== "function" ||
    typeof input.client?.fetch !== "function"
  ) {
    throw new TypeError("E-WIQ-EVIDENCE-INPUT: invalid source accessibility probe input");
  }
}

function sameIdentity(actual: ValidatedWorkIqDelegatedClaims, expected: ValidatedWorkIqDelegatedClaims): boolean {
  return actual.tenantId === expected.tenantId && actual.subject === expected.subject;
}

export async function probeWorkIqSourceAccessibility(
  input: WorkIqSourceAccessibilityInput,
): Promise<WorkIqSourceAccessibilityResult> {
  assertProbeInput(input);
  const evidence: WorkIqSourceAccessibilityEvidence[] = [];

  for (const [referenceIndex, reference] of input.sourceReferences.entries()) {
    let entityUrl: string | undefined;
    try {
      entityUrl = input.resolveReference(reference);
    } catch {
      entityUrl = undefined;
    }
    if (typeof entityUrl !== "string" || entityUrl.trim() === "") {
      evidence.push({ referenceIndex, accessible: false, errorCode: "E-WIQ-REF-UNRESOLVED" });
      continue;
    }

    let result: Awaited<ReturnType<WorkIqSourceFetchClient["fetch"]>>;
    try {
      result = await input.client.fetch({ entityUrls: [entityUrl] });
    } catch {
      evidence.push({ referenceIndex, accessible: false, errorCode: "E-WIQ-REF-UNRESOLVED" });
      continue;
    }
    if (!result.ok) {
      evidence.push({ referenceIndex, accessible: false, errorCode: result.errorCode });
    } else if (!sameIdentity(result.identity, input.expectedIdentity)) {
      evidence.push({ referenceIndex, accessible: false, errorCode: "E-WIQ-REF-IDENTITY" });
    } else {
      evidence.push({ referenceIndex, accessible: true });
    }
  }

  return { allAccessible: evidence.every(({ accessible }) => accessible), evidence };
}

export async function probeWorkIqPermissionDifferential(
  input: WorkIqPermissionDifferentialInput,
): Promise<WorkIqPermissionDifferentialResult> {
  if (
    input.owner.expectedIdentity.tenantId !== input.comparison.expectedIdentity.tenantId ||
    input.owner.expectedIdentity.subject === input.comparison.expectedIdentity.subject
  ) {
    throw new TypeError("E-WIQ-EVIDENCE-INPUT: differential requires two users in the same tenant");
  }
  const [owner, comparison] = await Promise.all([
    probeWorkIqSourceAccessibility({
      sourceReferences: input.sourceReferences,
      resolveReference: input.resolveReference,
      ...input.owner,
    }),
    probeWorkIqSourceAccessibility({
      sourceReferences: input.sourceReferences,
      resolveReference: input.resolveReference,
      ...input.comparison,
    }),
  ]);
  const comparisonConclusive = comparison.evidence.every(
    ({ accessible, errorCode }) => accessible || errorCode === "E-WIQ-ACCESS-DENIED",
  );
  return {
    passed:
      owner.allAccessible &&
      comparisonConclusive &&
      comparison.evidence.some(({ errorCode }) => errorCode === "E-WIQ-ACCESS-DENIED"),
    owner,
    comparison,
  };
}

export async function hashWorkIqQuestion(question: string): Promise<string> {
  if (typeof question !== "string" || question.trim() === "") {
    throw new TypeError("E-WIQ-EVIDENCE-INPUT: question is required");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(question));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
