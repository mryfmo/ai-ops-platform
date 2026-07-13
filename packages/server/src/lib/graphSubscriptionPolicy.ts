/**
 * packages/server/src/lib/graphSubscriptionPolicy.ts
 *
 * 根拠: ADR-0005 / SPEC-INT-001。Microsoft Graph v1.0 chatMessage subscription policy,
 * checked 2026-07-11:
 * https://learn.microsoft.com/en-us/graph/api/resources/subscription?view=graph-rest-1.0
 * https://learn.microsoft.com/en-us/graph/teams-changenotifications-chatmessage
 */
import { assertGraphSubscriptionExpiration, GRAPH_CHAT_MESSAGE_MAX_LIFETIME_MINUTES } from "@aiops/shared";

export { GRAPH_CHAT_MESSAGE_MAX_LIFETIME_MINUTES };
export const GRAPH_SUBSCRIPTION_SAFETY_BUFFER_MINUTES = 5;
export const GRAPH_SUBSCRIPTION_RENEW_MARGIN_MINUTES = 6 * 60;

function requireValidDate(value: Date, name: string): number {
  const milliseconds = value.getTime();
  if (!Number.isFinite(milliseconds)) throw new Error(`${name} must be a valid Date`);
  return milliseconds;
}

export function buildGraphChatMessageResource(teamId: string, channelId: string): string {
  const team = teamId?.trim();
  const channel = channelId?.trim();
  if (!team) throw new Error("teamId must be nonblank");
  if (!channel) throw new Error("channelId must be nonblank");
  if (/[\\/%\s\p{Z}\p{C}]/u.test(team + channel))
    throw new Error("teamId and channelId must be canonical Graph path segments");
  return `/teams/${encodeURIComponent(team)}/channels/${encodeURIComponent(channel)}/messages`;
}

/** Shared create/renew/lifecycle target, buffered below Graph's 4,320-minute cap. */
export function computeGraphSubscriptionExpiration(now: Date): string {
  return new Date(
    requireValidDate(now, "now") +
      (GRAPH_CHAT_MESSAGE_MAX_LIFETIME_MINUTES - GRAPH_SUBSCRIPTION_SAFETY_BUFFER_MINUTES) * 60_000,
  ).toISOString();
}

export function isGraphSubscriptionRenewalDue(expiresAt: string, now: Date): boolean {
  const expiration = Date.parse(expiresAt);
  if (!Number.isFinite(expiration)) return true;
  return expiration - requireValidDate(now, "now") <= GRAPH_SUBSCRIPTION_RENEW_MARGIN_MINUTES * 60_000;
}

export function validateGraphSubscriptionExpiration(expiration: string, now: Date): string {
  assertGraphSubscriptionExpiration(expiration, now);
  return expiration;
}
