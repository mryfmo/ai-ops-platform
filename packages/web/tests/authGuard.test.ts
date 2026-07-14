/**
 * packages/web/tests/authGuard.test.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。/api/data/* や /api/chat が今後利用する
 *   認可ゲート（requireSession/requirePersona）のユニットテスト。
 *   未認証・該当ペルソナなしのハンドリングを検証する。
 */
import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import {
  ForbiddenError,
  UnauthorizedError,
  personaKey,
  requirePersona,
  requireSession,
  selectPersona,
  selectedPersonaFromRequest,
} from "../src/server/authGuard";
import type { PersonaResolver, ResolvedPersona } from "../src/server/personaResolver";

describe("requireSession（ADR-0005: 未認証のハンドリング）", () => {
  it("セッションが無い場合 UnauthorizedError(401) を投げる", async () => {
    await expect(requireSession(async () => null)).rejects.toMatchObject({
      status: 401,
    });
    await expect(requireSession(async () => null)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("セッションはあるがemailが無い場合も UnauthorizedError を投げる", async () => {
    const session = { user: {}, expires: "2099-01-01T00:00:00.000Z" } as Session;
    await expect(requireSession(async () => session)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("email付きセッションがあればそのまま返す", async () => {
    const session = {
      user: { email: "user@example.com" },
      expires: "2099-01-01T00:00:00.000Z",
    } as Session;
    const result = await requireSession(async () => session);
    expect(result.user?.email).toBe("user@example.com");
  });
});

describe("requirePersona（ADR-0005: 該当ペルソナなしのハンドリング）", () => {
  function resolverWith(personas: ResolvedPersona[]): PersonaResolver {
    return { resolveByEmail: async () => personas };
  }

  it("該当ペルソナが0件の場合 ForbiddenError(403) を投げる", async () => {
    const resolver = resolverWith([]);
    await expect(requirePersona("nobody@example.com", resolver)).rejects.toMatchObject({
      status: 403,
    });
    await expect(requirePersona("nobody@example.com", resolver)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("該当ペルソナがある場合はそのまま返す", async () => {
    const personas: ResolvedPersona[] = [
      {
        domain: "devops",
        profile: "PRF-G",
        visibility: { recipientUserId: "U1", recipientAssignedProjectIds: [] },
      },
    ];
    const resolver = resolverWith(personas);
    const result = await requirePersona("user@example.com", resolver);
    expect(result).toEqual(personas);
  });

  it("domain指定時は該当ドメインのみへ絞り込み、絞り込んだ結果が0件ならForbiddenError", async () => {
    const personas: ResolvedPersona[] = [
      {
        domain: "prjops",
        profile: "PRF-01",
        visibility: {
          recipientStakeholderId: "STK-001",
          recipientManagedProjectIds: [],
          recipientAssignedProjectIds: [],
          recipientParticipatingProjectIds: [],
          investedProjectIds: [],
        },
      },
    ];
    const resolver = resolverWith(personas);
    await expect(requirePersona("user@example.com", resolver, "devops")).rejects.toBeInstanceOf(ForbiddenError);
    const result = await requirePersona("user@example.com", resolver, "prjops");
    expect(result).toEqual(personas);
  });

  it("申告ペルソナが現在の保有ペルソナに無ければ403にする [PrjOps:REQ-041 / DevOps:REQ-041 / PrjOps:SPEC-INT-068 / DevOps:SPEC-INT-068]", async () => {
    const personas: ResolvedPersona[] = [
      {
        domain: "devops",
        profile: "PRF-G",
        visibility: { recipientUserId: "U1", recipientAssignedProjectIds: [] },
      },
    ];
    await expect(
      requirePersona("user@example.com", resolverWith(personas), undefined, "prjops:PRF-04"),
    ).rejects.toMatchObject({
      status: 403,
    });
  });

  it("entitlement削除後の古い選択も毎回再解決して403にする [PrjOps:REQ-041 / DevOps:REQ-041 / PrjOps:SPEC-INT-068 / DevOps:SPEC-INT-068]", async () => {
    const resolver: PersonaResolver = { resolveByEmail: async () => [] };
    await expect(requirePersona("user@example.com", resolver, undefined, "devops:PRF-G")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("選択省略時は先頭、正当な選択時は該当ペルソナを返す [PrjOps:REQ-041 / DevOps:REQ-041 / PrjOps:SPEC-INT-068 / DevOps:SPEC-INT-068]", () => {
    const personas: ResolvedPersona[] = [
      {
        domain: "devops",
        profile: "PRF-L",
        visibility: { recipientUserId: "U1", recipientAssignedProjectIds: [] },
      },
      {
        domain: "devops",
        profile: "PRF-G",
        visibility: { recipientUserId: "U1", recipientAssignedProjectIds: [] },
      },
    ];
    expect(selectPersona(personas)).toBe(personas[0]);
    expect(personaKey(selectPersona(personas, "devops:PRF-G"))).toBe("devops:PRF-G");
  });

  it("API requestの選択Cookieを読み取る [PrjOps:REQ-041 / DevOps:REQ-041 / PrjOps:SPEC-INT-068 / DevOps:SPEC-INT-068]", () => {
    const request = new Request("https://example.test/app/api/data/projects", {
      headers: { cookie: "other=x; aiops-persona=devops:PRF-G" },
    });
    expect(selectedPersonaFromRequest(request)).toBe("devops:PRF-G");
  });
});
