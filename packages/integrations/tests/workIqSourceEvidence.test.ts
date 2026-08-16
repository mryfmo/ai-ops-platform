// 根拠: ADR-0024 / WIQ-001 / WIQ-002 / WIQ-005
import { describe, expect, it, vi } from "vitest";

import {
  hashWorkIqQuestion,
  probeWorkIqPermissionDifferential,
  probeWorkIqSourceAccessibility,
  type WorkIqFetchResult,
  type WorkIqSourceReference,
  type WorkIqSourceReferenceResolver,
  type WorkIqSourceFetchClient,
  type ValidatedWorkIqDelegatedClaims,
} from "../src/index.js";

const TENANT_ID = "00000000-0000-0000-0000-000000000000";

function claims(subject: string): ValidatedWorkIqDelegatedClaims {
  return {
    issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
    tenantId: TENANT_ID,
    audience: "api://workiq.svc.cloud.microsoft",
    subject,
    scopes: ["WorkIQAgent.Ask"],
  };
}

const references: WorkIqSourceReference[] = [
  { system: "outlook", objectId: "message-1" },
  { system: "teams", objectId: "message-2" },
];

const resolveReference: WorkIqSourceReferenceResolver = (reference) =>
  typeof reference.objectId === "string" ? `/me/messages/${reference.objectId}` : undefined;

function fetchResult(): WorkIqFetchResult {
  return {
    results: [
      {
        data: { ignoredByEvidence: true },
        statusCode: 200,
        sourceReferences: [],
        permissionContext: null,
        provenanceComplete: false,
      },
    ],
    sourceReferences: [],
    permissionContext: null,
    provenanceComplete: false,
  };
}

function accessibleClient(identity: ValidatedWorkIqDelegatedClaims): WorkIqSourceFetchClient {
  return {
    fetch: vi.fn(async () => ({ ok: true as const, value: fetchResult(), identity })),
  };
}

describe("Work IQ source accessibility evidence [ADR-0024] [WIQ-002]", () => {
  it("records only indexed accessibility evidence for references reachable by the same delegated user", async () => {
    const owner = claims("user-a");
    const client = accessibleClient(owner);

    const result = await probeWorkIqSourceAccessibility({
      sourceReferences: references,
      expectedIdentity: owner,
      client,
      resolveReference,
    });

    expect(result).toEqual({
      allAccessible: true,
      evidence: [
        { referenceIndex: 0, accessible: true },
        { referenceIndex: 1, accessible: true },
      ],
    });
    expect(client.fetch).toHaveBeenNthCalledWith(1, { entityUrls: ["/me/messages/message-1"] });
    expect(JSON.stringify(result)).not.toContain("ignoredByEvidence");
  });

  it("detects the permission-trim differential when user A references are inaccessible to user B", async () => {
    const owner = claims("user-a");
    const comparison = claims("user-b");
    const comparisonFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false as const, errorCode: "E-WIQ-ACCESS-DENIED" })
      .mockResolvedValueOnce({
        ok: true as const,
        value: fetchResult(),
        identity: comparison,
      });

    const result = await probeWorkIqPermissionDifferential({
      sourceReferences: references,
      owner: { expectedIdentity: owner, client: accessibleClient(owner) },
      comparison: { expectedIdentity: comparison, client: { fetch: comparisonFetch } },
      resolveReference,
    });

    expect(result.passed).toBe(true);
    expect(result.owner.allAccessible).toBe(true);
    expect(result.comparison).toEqual({
      allAccessible: false,
      evidence: [
        { referenceIndex: 0, accessible: false, errorCode: "E-WIQ-ACCESS-DENIED" },
        { referenceIndex: 1, accessible: true },
      ],
    });
  });

  it("does not pass when an access denial is mixed with a comparison-user operational failure", async () => {
    const owner = claims("user-a");
    const comparison = claims("user-b");
    const comparisonFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false as const, errorCode: "E-WIQ-ACCESS-DENIED" })
      .mockResolvedValueOnce({ ok: false as const, errorCode: "E-WIQ-TIMEOUT" });

    await expect(
      probeWorkIqPermissionDifferential({
        sourceReferences: references,
        owner: { expectedIdentity: owner, client: accessibleClient(owner) },
        comparison: {
          expectedIdentity: comparison,
          client: { fetch: comparisonFetch },
        },
        resolveReference,
      }),
    ).resolves.toMatchObject({ passed: false });
  });

  it("fails closed for unresolved references and a successful fetch under the wrong identity", async () => {
    const owner = claims("user-a");
    const wrongIdentity = claims("user-b");

    await expect(
      probeWorkIqSourceAccessibility({
        sourceReferences: [{ unsupported: true }, references[0]!],
        expectedIdentity: owner,
        client: accessibleClient(wrongIdentity),
        resolveReference,
      }),
    ).resolves.toEqual({
      allAccessible: false,
      evidence: [
        { referenceIndex: 0, accessible: false, errorCode: "E-WIQ-REF-UNRESOLVED" },
        { referenceIndex: 1, accessible: false, errorCode: "E-WIQ-REF-IDENTITY" },
      ],
    });
  });

  it("rejects empty, oversized, and same-user differential inputs before any fetch", async () => {
    const owner = claims("user-a");
    const client = accessibleClient(owner);

    await expect(
      probeWorkIqSourceAccessibility({
        sourceReferences: [],
        expectedIdentity: owner,
        client,
        resolveReference,
      }),
    ).rejects.toThrow("E-WIQ-EVIDENCE-INPUT");
    await expect(
      probeWorkIqSourceAccessibility({
        sourceReferences: Array.from({ length: 33 }, () => references[0]!),
        expectedIdentity: owner,
        client,
        resolveReference,
      }),
    ).rejects.toThrow("E-WIQ-EVIDENCE-INPUT");
    await expect(
      probeWorkIqPermissionDifferential({
        sourceReferences: references,
        owner: { expectedIdentity: owner, client },
        comparison: { expectedIdentity: owner, client },
        resolveReference,
      }),
    ).rejects.toThrow("E-WIQ-EVIDENCE-INPUT");
    expect(client.fetch).not.toHaveBeenCalled();
  });

  it("hashes the exact question without retaining plaintext [WIQ-001] [WIQ-005]", async () => {
    const question = "What changed in the synthetic project?";
    const digest = await hashWorkIqQuestion(question);

    expect(digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(digest).toBe(await hashWorkIqQuestion(question));
    expect(digest).not.toContain(question);
    await expect(hashWorkIqQuestion("  ")).rejects.toThrow("E-WIQ-EVIDENCE-INPUT");
  });
});
