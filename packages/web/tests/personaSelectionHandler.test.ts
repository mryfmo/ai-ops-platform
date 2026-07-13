/**
 * packages/web/tests/personaSelectionHandler.test.ts
 *
 * 根拠: ADR-0005 / AUD-IMP-006。ペルソナ選択 action の認証・認可とCookie保存を検証する。
 */
import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import type { PersonaResolver, ResolvedPersona } from "../src/server/personaResolver";
import { handlePersonaSelection } from "../src/server/personaSelectionHandler";

const session = async (): Promise<Session | null> =>
  ({ user: { email: "user@example.com" }, expires: "2099-01-01T00:00:00.000Z" }) as Session;

function resolverWith(personas: ResolvedPersona[]): PersonaResolver {
  return { resolveByEmail: async () => personas };
}

const manager: ResolvedPersona = {
  domain: "devops",
  profile: "PRF-G",
  visibility: { recipientUserId: "U1", recipientAssignedProjectIds: [] },
};

describe("handlePersonaSelection [REQ-041 / SPEC-INT-068]", () => {
  it("現在保有するペルソナだけをHttpOnly Cookieに保存する [REQ-041 / SPEC-INT-068]", async () => {
    const response = await handlePersonaSelection({
      getSession: session,
      resolver: resolverWith([manager]),
      selectedPersona: "devops:PRF-G",
      secureCookie: true,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBe(
      "aiops-persona=devops:PRF-G; Path=/app; HttpOnly; SameSite=Lax; Secure",
    );
  });

  it("不正申告とentitlement削除後の古い選択は403で保存しない [REQ-041 / SPEC-INT-068]", async () => {
    for (const resolver of [resolverWith([manager]), resolverWith([])]) {
      const response = await handlePersonaSelection({
        getSession: session,
        resolver,
        selectedPersona: "prjops:PRF-04",
      });
      expect(response.status).toBe(403);
      expect(response.headers.get("set-cookie")).toBeNull();
    }
  });
});
