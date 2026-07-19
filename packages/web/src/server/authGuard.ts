/**
 * packages/web/src/server/authGuard.ts
 *
 * 根拠: ADR-0005 / DevOps:SPEC-INT-054 / PrjOps:REQ-041。
 * stable subject を request-time persona lookup へ渡し、申告 selector を active assignment と照合する。
 */
import type { Session } from "next-auth";
import type { EntraSubject, PersonaResolver, ResolvedPersona } from "./personaResolver";

export const PERSONA_COOKIE = "aiops-persona";

export type AuthenticatedSession = Session & {
  user: NonNullable<Session["user"]> & { subject: EntraSubject; roles: string[] };
};

export function personaKey(persona: ResolvedPersona): string {
  const scope = persona.scope.mode === "global" ? "global" : persona.scope.projectId;
  return `${persona.domain}:${persona.profile}:${scope}`;
}

export function selectedPersonaFromRequest(request: Request): string | undefined {
  const cookie = request.headers.get("cookie");
  if (!cookie) return undefined;
  for (const part of cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === PERSONA_COOKIE) return value.join("=") || undefined;
  }
  return undefined;
}

export function selectPersona(personas: ResolvedPersona[], selectedPersona?: string): ResolvedPersona {
  if (selectedPersona === undefined && personas.length > 1) {
    throw new ConflictError();
  }
  const persona =
    selectedPersona === undefined
      ? personas[0]
      : personas.find((candidate) => personaKey(candidate) === selectedPersona);
  if (!persona) {
    throw new ForbiddenError(
      selectedPersona
        ? "E-AUTH02: selected persona is not assigned to this account"
        : "E-AUTH02: no matching persona for this account",
    );
  }
  return persona;
}

export class UnauthorizedError extends Error {
  public readonly status = 401 as const;
  constructor(message = "E-AUTH01: authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  public readonly status = 403 as const;
  constructor(message = "E-AUTH02: no matching persona for this account") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends Error {
  public readonly status = 409 as const;
  constructor(message = "E-AUTH03: persona selection required") {
    super(message);
    this.name = "ConflictError";
  }
}

export async function requireSession(getSession: () => Promise<Session | null>): Promise<AuthenticatedSession> {
  const session = await getSession();
  const subject = session?.user?.subject;
  if (
    !session?.user ||
    !subject ||
    typeof subject.tenantId !== "string" ||
    typeof subject.objectId !== "string" ||
    !Array.isArray(session.user.roles)
  ) {
    throw new UnauthorizedError();
  }
  return session as AuthenticatedSession;
}

export async function requirePersona(
  subject: EntraSubject,
  resolver: PersonaResolver,
  domain?: ResolvedPersona["domain"],
  selectedPersona?: string,
): Promise<ResolvedPersona[]> {
  const personas = await resolver.resolveBySubject(subject);
  if (selectedPersona === undefined && personas.length > 1) throw new ConflictError();
  const filtered = domain ? personas.filter((persona) => persona.domain === domain) : personas;
  return [selectPersona(filtered, selectedPersona)];
}
