/** 根拠: FinalArch:MCP-001 / FinalArch:MCP-003 / ADR-0023 / WBS P4-T11。authGuard配下のMCP operations画面。 */
import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { requireSession, UnauthorizedError } from "../../../server/authGuard";
import { McpOpsPanel } from "./McpOpsPanel";

export default async function McpOpsPage() {
  try {
    await requireSession(auth);
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login");
    throw error;
  }
  return <McpOpsPanel />;
}
