/** 根拠: DevOps:SPEC-EXT-010 / DevOps:REQ-028 / AUD-OPM-001。authGuard配下の承認画面。 */
import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { requireSession, UnauthorizedError } from "../../server/authGuard";
import { ApprovalsPanel } from "./ApprovalsPanel";

export default async function ApprovalsPage() {
  try {
    await requireSession(auth);
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login");
    throw error;
  }
  return <ApprovalsPanel />;
}
