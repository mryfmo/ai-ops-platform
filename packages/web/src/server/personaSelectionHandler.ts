/**
 * packages/web/src/server/personaSelectionHandler.ts
 *
 * 根拠: ADR-0005 / AUD-IMP-006。選択ペルソナは認可情報ではなく申告値として保存し、
 * 現在の認証済みユーザーに割り当てられたペルソナかを保存前にも検証する。
 */
import type { Session } from "next-auth";
import type { PersonaResolver } from "./personaResolver";
import { PERSONA_COOKIE } from "./authGuard";
import { resolvePersonas, toErrorResponse } from "./reportData/dataApiSupport";

export interface PersonaSelectionHandlerDeps {
  getSession: () => Promise<Session | null>;
  resolver: PersonaResolver;
  selectedPersona: string;
  secureCookie?: boolean;
}

export async function handlePersonaSelection(deps: PersonaSelectionHandlerDeps): Promise<Response> {
  try {
    await resolvePersonas(deps.getSession, deps.resolver, undefined, deps.selectedPersona);
    const attributes = [`${PERSONA_COOKIE}=${deps.selectedPersona}`, "Path=/app", "HttpOnly", "SameSite=Lax"];
    if (deps.secureCookie) attributes.push("Secure");
    return Response.json(
      { selectedPersona: deps.selectedPersona },
      { headers: { "Set-Cookie": attributes.join("; ") } },
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
