/**
 * packages/prjops/src/agents/AGT05_distributor.ts
 *
 * 根拠: REQ-018 配信 / SPEC-INT-052 冪等配信 / ADR-0014 REQ-042 SPEC-INT-069 AC-042-1
 *   承認済み（PRF-04/05）または検証済み（PRF-01〜03）レポートを、Outlookメール（HTML添付）で
 *   各受信者へ個別配信し、併せてPRF-02/03にはTeamsチャネルにも要約カードを投稿する。
 *   AC-018-1: 1配信サイクル最大2,000通が2時間以内に完了する。
 *   AC-018-2: 同一レポートIDの重複配信が発生しない（再送時も受信者ごとに1通）。
 */
import type { GraphClient } from "@aiops/shared/clients/graphClient.js";
import type { AuditLogWriter } from "@aiops/shared/auditLog.js";
import { decideDelivery, type DeliveryLogStore } from "../lib/idempotentDelivery.js";

export interface DeliveryTarget {
  reportId: string;
  recipientId: string;
  recipientEmail: string;
  subject: string;
  html: string;
  postTeamsSummaryCard: boolean; // PRF-02/03向けのみtrue
  teamsChannelId?: string;
  dashboardUrl?: string;
}

export interface DistributorDependencies {
  graphClient: Pick<GraphClient, "sendMail" | "sendAdaptiveCard">;
  deliveryLogStore: DeliveryLogStore;
  auditLog: AuditLogWriter;
  traceId: string;
  fromMailbox: string;
}

export interface DistributionResult {
  sent: string[]; // recipientId一覧
  skipped: string[]; // 冪等制御によりスキップされたrecipientId一覧
  failed: Array<{ recipientId: string; error: string }>;
}

const cardRecipientId = (recipientId: string): string => `${recipientId}#teams-card`;

/** REQ-018 + SPEC-INT-052: 1件の配信対象に対する冪等配信処理（SPEC-EXT-037 レポート配信/遅延通知） */
export async function distributeOne(
  target: DeliveryTarget,
  deps: DistributorDependencies,
  isRetryAttempt = false,
): Promise<"sent" | "skipped" | "failed"> {
  const decision = await decideDelivery(deps.deliveryLogStore, target.reportId, target.recipientId, isRetryAttempt);
  let sentSomething = false;

  const subject = target.subject + (decision.subjectSuffix ? ` ${decision.subjectSuffix}` : "");
  try {
    if (decision.shouldSend) {
      const deliveredAt = new Date().toISOString();
      await deps.deliveryLogStore.record({
        reportId: target.reportId,
        recipientId: target.recipientId,
        deliveredAt,
        status: "pending",
      });
      await deps.graphClient.sendMail({
        toEmail: target.recipientEmail,
        subject,
        htmlBody: target.html,
        fromMailbox: deps.fromMailbox,
      });
      if (deps.deliveryLogStore.markSent) {
        await deps.deliveryLogStore.markSent(target.reportId, target.recipientId, deliveredAt);
      } else {
        await deps.deliveryLogStore.record({
          reportId: target.reportId,
          recipientId: target.recipientId,
          deliveredAt,
          status: "sent",
        });
      }
      sentSomething = true;
    }

    if (target.postTeamsSummaryCard && target.teamsChannelId) {
      const cardId = cardRecipientId(target.recipientId);
      const cardDecision = await decideDelivery(deps.deliveryLogStore, target.reportId, cardId, isRetryAttempt);
      if (cardDecision.shouldSend) {
        const cardDeliveredAt = new Date().toISOString();
        await deps.deliveryLogStore.record({
          reportId: target.reportId,
          recipientId: cardId,
          deliveredAt: cardDeliveredAt,
          status: "pending",
        });
        try {
          await deps.graphClient.sendAdaptiveCard({
            channelOrChatId: target.teamsChannelId,
            card: {
              body: [{ type: "TextBlock", text: `レポート ${target.reportId} を配信しました`, wrap: true }],
              actions: [],
              openUrlActions: target.dashboardUrl ? [{ title: "Dashboard", url: target.dashboardUrl }] : [],
            },
          });
          if (deps.deliveryLogStore.markSent) {
            await deps.deliveryLogStore.markSent(target.reportId, cardId, cardDeliveredAt);
          } else {
            await deps.deliveryLogStore.record({
              reportId: target.reportId,
              recipientId: cardId,
              deliveredAt: cardDeliveredAt,
              status: "sent",
            });
          }
          sentSomething = true;
        } catch (err) {
          await deps.auditLog.append({
            trace_id: deps.traceId,
            actor: "AGT-05",
            action: "deliver_card_failed",
            basis: "REQ-031",
            detail: { reportId: target.reportId, recipientId: target.recipientId, error: String(err) },
            at: new Date().toISOString(),
          });
          if (!sentSomething) throw err;
        }
      }
    }

    await deps.auditLog.append({
      trace_id: deps.traceId,
      actor: "AGT-05",
      action: "deliver",
      basis: "REQ-018",
      detail: { reportId: target.reportId, recipientId: target.recipientId },
      at: new Date().toISOString(),
    });
    return sentSomething ? "sent" : "skipped";
  } catch (err) {
    await deps.auditLog.append({
      trace_id: deps.traceId,
      actor: "AGT-05",
      action: "deliver_failed",
      basis: "REQ-031",
      detail: { reportId: target.reportId, recipientId: target.recipientId, error: String(err) },
      at: new Date().toISOString(),
    });
    throw err;
  }
}

/** 配信サイクル本体（AC-018-1: 最大2,000通/2時間の呼び出し元。並行数は呼び出し側のスケジューラ設定に委ねる） */
export async function runDistributionCycle(
  targets: DeliveryTarget[],
  deps: DistributorDependencies,
): Promise<DistributionResult> {
  const result: DistributionResult = { sent: [], skipped: [], failed: [] };
  for (const target of targets) {
    try {
      const outcome = await distributeOne(target, deps);
      if (outcome === "sent") result.sent.push(target.recipientId);
      else result.skipped.push(target.recipientId);
    } catch (err) {
      result.failed.push({ recipientId: target.recipientId, error: String(err) });
    }
  }
  return result;
}

/**
 * REQ-003 進捗報告依頼の自動送付 / SPEC-EXT-010 報告依頼メッセージ / SPEC-EXT-030 通知一覧(依頼)。
 * 毎週水曜09:00 JSTに、全activeプロジェクトの報告担当者へTeams/メールで報告依頼を送付する（TOBE-01）。
 * 件名形式: 【進捗報告依頼】{プロジェクト名} ({PJ-nnn}) {YYYY-MM-DD}週 / en: [Status Request] ...
 */
export interface ProgressReportRequestTarget {
  projectId: string;
  projectName: string;
  weekLabel: string; // YYYY-MM-DD週
  recipientEmail: string;
  lang: "ja" | "en";
  previousSummary3Lines: string; // 前回報告の要約3行（SPEC-EXT-010）
}

export async function sendProgressReportRequests(
  targets: ProgressReportRequestTarget[],
  deps: Pick<DistributorDependencies, "graphClient" | "auditLog" | "traceId" | "fromMailbox">,
): Promise<void> {
  for (const t of targets) {
    const subject =
      t.lang === "ja"
        ? `【進捗報告依頼】${t.projectName} (${t.projectId}) ${t.weekLabel}週`
        : `[Status Request] ${t.projectName} (${t.projectId}) week of ${t.weekLabel}`;
    await deps.graphClient.sendMail({
      toEmail: t.recipientEmail,
      subject,
      htmlBody: `<p>${t.lang === "ja" ? "今週の進捗をご報告ください。前回要約" : "Please report this week's progress. Previous summary"}:</p><p>${t.previousSummary3Lines}</p>`,
      fromMailbox: deps.fromMailbox,
    });
  }
  await deps.auditLog.append({
    trace_id: deps.traceId,
    actor: "AGT-05",
    action: "send_request",
    basis: "REQ-003",
    detail: { count: targets.length },
    at: new Date().toISOString(),
  });
}
