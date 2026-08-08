/** 根拠: DevOps:SPEC-EXT-010 / AUD-OPM-001。pending承認一覧とapprove/reject操作。 */
"use client";

import { useEffect, useState } from "react";

interface PendingApproval {
  approvalId: string;
  approvalType: "change" | "report" | "jit_grant";
  targetId: string;
  status: "pending";
  requestedBy: string;
  createdAt: string;
}

export function ApprovalsPanel() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string>();
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    let active = true;
    void fetch("/app/api/approvals")
      .then(async (response) => {
        const payload = (await response.json()) as { approvals?: PendingApproval[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "承認一覧を取得できませんでした");
        if (active) setApprovals(payload.approvals ?? []);
      })
      .catch((error: unknown) => {
        if (active) setMessage(error instanceof Error ? error.message : "承認一覧を取得できませんでした");
      });
    return () => {
      active = false;
    };
  }, []);

  async function decide(approvalId: string, decision: "approved" | "rejected") {
    setBusy(approvalId);
    setMessage(undefined);
    try {
      const body = decision === "rejected" ? { decision, reason: reasons[approvalId]!.trim() } : { decision };
      const response = await fetch(`/app/api/approvals/${approvalId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "承認判断を保存できませんでした");
      setApprovals((current) => current.filter((approval) => approval.approvalId !== approvalId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "承認判断を保存できませんでした");
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">承認待ち</h1>
      {approvals.length === 0 && !message ? <p>承認待ちの項目はありません。</p> : null}
      {approvals.map((approval) => {
        const reason = reasons[approval.approvalId] ?? "";
        return (
          <article className="space-y-3 rounded border p-4" key={approval.approvalId}>
            <h2 className="font-semibold">{approval.targetId}</h2>
            <p className="text-sm">種別: {approval.approvalType}</p>
            <p className="text-sm">依頼者: {approval.requestedBy}</p>
            <label className="block text-sm" htmlFor={`reason-${approval.approvalId}`}>
              差し戻し理由
            </label>
            <textarea
              id={`reason-${approval.approvalId}`}
              className="w-full rounded border p-2"
              value={reason}
              onChange={(event) => setReasons((current) => ({ ...current, [approval.approvalId]: event.target.value }))}
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy === approval.approvalId}
                onClick={() => decide(approval.approvalId, "approved")}
              >
                承認
              </button>
              <button
                type="button"
                disabled={busy === approval.approvalId || reason.trim() === ""}
                onClick={() => decide(approval.approvalId, "rejected")}
              >
                差し戻し
              </button>
            </div>
          </article>
        );
      })}
      {message ? <p aria-live="polite">{message}</p> : null}
    </section>
  );
}
