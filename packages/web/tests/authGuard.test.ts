/**
 * packages/web/tests/authGuard.test.ts
 *
 * 根拠: ADR-0005 / DevOps:SPEC-INT-054 / PrjOps:REQ-041。
 */
import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import {
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
  personaKey,
  requirePersona,
  requireSession,
  selectPersona,
  selectedPersonaFromRequest,
} from "../src/server/authGuard";
import type { PersonaResolver, ResolvedPersona } from "../src/server/personaResolver";

const subject = {
  tenantId: "11111111-1111-1111-1111-111111111111",
  objectId: "22222222-2222-2222-2222-222222222222",
};
const manager: ResolvedPersona = {
  domain: "devops",
  profile: "PRF-G",
  scope: { mode: "global", projectId: null },
  visibility: { recipientUserId: "U1", recipientAssignedProjectIds: [] },
};

function resolverWith(personas: ResolvedPersona[]): PersonaResolver {
  return { resolveBySubject: async () => personas };
}

describe("requireSession [DevOps:SPEC-INT-054]", () => {
  it("sessionまたはstable subjectが無ければ401にする", async () => {
    await expect(requireSession(async () => null)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(
      requireSession(async () => ({ user: { email: "legacy@example.com" }, expires: "2099-01-01" }) as Session),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("stable subjectとroles付きsessionだけを認証済みcallerとして返す", async () => {
    const session = { user: { subject, roles: ["Reader"] }, expires: "2099-01-01" } as Session;
    const result = await requireSession(async () => session);
    expect(result.user.subject).toEqual(subject);
    expect(result.user.roles).toEqual(["Reader"]);
  });
});

describe("requirePersona [PrjOps:REQ-041 / DevOps:SPEC-INT-054]", () => {
  it("stable subjectで毎回解決し0件なら403にする", async () => {
    const resolver = resolverWith([]);
    await expect(requirePersona(subject, resolver)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("1件だけなら選択省略で自動選択する", async () => {
    await expect(requirePersona(subject, resolverWith([manager]))).resolves.toEqual([manager]);
  });

  it("複数件で選択省略ならE-AUTH03の409にする", async () => {
    const second: ResolvedPersona = {
      domain: "devops",
      profile: "PRF-L",
      scope: { mode: "project", projectId: "PJ-001" },
      visibility: { recipientUserId: "U1", recipientAssignedProjectIds: ["PJ-001"] },
    };
    await expect(requirePersona(subject, resolverWith([manager, second]))).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("E-AUTH03"),
    });
    await expect(requirePersona(subject, resolverWith([manager, second]))).rejects.toBeInstanceOf(ConflictError);
  });

  it("全domainの単一性を先に判定し、exact assignmentだけを選ぶ", async () => {
    const executive: ResolvedPersona = {
      domain: "prjops",
      profile: "PRF-04",
      scope: { mode: "project", projectId: "PJ-002" },
      visibility: {
        recipientStakeholderId: "ST-1",
        recipientManagedProjectIds: [],
        recipientAssignedProjectIds: [],
        recipientParticipatingProjectIds: [],
        investedProjectIds: [],
      },
    };
    await expect(requirePersona(subject, resolverWith([manager, executive]), "prjops")).rejects.toBeInstanceOf(
      ConflictError,
    );
    await expect(
      requirePersona(subject, resolverWith([manager, executive]), "prjops", "prjops:PRF-04:PJ-002"),
    ).resolves.toEqual([executive]);
    await expect(
      requirePersona(subject, resolverWith([manager, executive]), undefined, "prjops:PRF-04:PJ-999"),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      requirePersona(subject, resolverWith([manager, executive]), undefined, "prjops:PRF-04:PJ-002"),
    ).resolves.toEqual([executive]);
  });

  it("selector keyはdomain/profile/projectまたはglobalを含む", () => {
    const project: ResolvedPersona = {
      domain: "devops",
      profile: "PRF-L",
      scope: { mode: "project", projectId: "PJ-001" },
      visibility: { recipientUserId: "U1", recipientAssignedProjectIds: ["PJ-001"] },
    };
    expect(personaKey(manager)).toBe("devops:PRF-G:global");
    expect(personaKey(project)).toBe("devops:PRF-L:PJ-001");
    expect(selectPersona([manager], "devops:PRF-G:global")).toBe(manager);
  });

  it("API requestの選択Cookieを読み取る", () => {
    const request = new Request("https://example.test/app/api/data/projects", {
      headers: { cookie: "other=x; aiops-persona=devops:PRF-G:global" },
    });
    expect(selectedPersonaFromRequest(request)).toBe("devops:PRF-G:global");
  });
});
