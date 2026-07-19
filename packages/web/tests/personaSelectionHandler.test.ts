/**
 * packages/web/tests/personaSelectionHandler.test.ts
 *
 * 根拠: ADR-0005 / PrjOps:REQ-041 / DevOps:SPEC-INT-054。
 */
import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import type { PersonaResolver, ResolvedPersona } from "../src/server/personaResolver";
import { handlePersonaSelection } from "../src/server/personaSelectionHandler";

const subject = {
  tenantId: "11111111-1111-1111-1111-111111111111",
  objectId: "22222222-2222-2222-2222-222222222222",
};
const session = async (): Promise<Session | null> =>
  ({ user: { subject, roles: [] }, expires: "2099-01-01T00:00:00.000Z" }) as Session;

function resolverWith(personas: ResolvedPersona[]): PersonaResolver {
  return { resolveBySubject: async () => personas };
}

const manager: ResolvedPersona = {
  domain: "devops",
  profile: "PRF-G",
  scope: { mode: "global", projectId: null },
  visibility: { recipientUserId: "U1", recipientAssignedProjectIds: [] },
};

describe("handlePersonaSelection [PrjOps:REQ-041 / DevOps:SPEC-INT-054]", () => {
  it("現在保有するexact assignmentだけをHttpOnly Cookieに保存する", async () => {
    const response = await handlePersonaSelection({
      getSession: session,
      resolver: resolverWith([manager]),
      selectedPersona: "devops:PRF-G:global",
      secureCookie: true,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBe(
      "aiops-persona=devops:PRF-G:global; Path=/app; HttpOnly; SameSite=Lax; Secure",
    );
  });

  it("不正申告とentitlement削除後の古い選択は403で保存しない", async () => {
    for (const resolver of [resolverWith([manager]), resolverWith([])]) {
      const response = await handlePersonaSelection({
        getSession: session,
        resolver,
        selectedPersona: "prjops:PRF-04:PJ-001",
      });
      expect(response.status).toBe(403);
      expect(response.headers.get("set-cookie")).toBeNull();
    }
  });
});
