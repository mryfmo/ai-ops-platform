/**
 * packages/server/src/lib/dashboardDeepLink.ts
 *
 * 根拠: ADR-0014 / REQ-042 / SPEC-INT-069 / AC-042-1。
 * Outlook/Teams配信カードからWebダッシュボードへ遷移するディープリンクを生成する。
 */
export interface DashboardDeepLinkInput {
  publicBaseUrl: string;
  persona: string;
  periodLabel: string;
}

export function buildDashboardDeepLink(input: DashboardDeepLinkInput): string {
  const url = new URL("/app/dashboard", input.publicBaseUrl);
  url.searchParams.set("persona", input.persona);
  url.searchParams.set("period", input.periodLabel);
  return url.toString();
}
