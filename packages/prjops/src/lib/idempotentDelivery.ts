/**
 * packages/prjops/src/lib/idempotentDelivery.ts
 *
 * 根拠: PrjOps:SPEC-INT-010 / PrjOps:SPEC-INT-052 冪等配信 / PrjOps:REQ-018 PrjOps:AC-018-2
 *   PrjOps:SPEC-INT-010原仕様のprjops-reports物理リポジトリはADR-0001/ADR-0014/DEC-SPEC-004により
 *   PostgreSQL/archiveのDeliveryLogStore境界へ置換された。配信前にrecordの存在を確認し、存在すればスキップ。
 *   送信成功後に記録を書く（記録失敗時は再送許容だが件名 (再送) を付与）。
 *   PrjOps:SPEC-EXT-023: 重複して2通届くことはない。
 */

export interface DeliveryLogEntry {
  reportId: string;
  recipientId: string;
  deliveredAt: string;
  status?: "pending" | "sent";
}

export interface DeliveryLogStore {
  exists(reportId: string, recipientId: string): Promise<boolean>;
  record(entry: DeliveryLogEntry): Promise<void>;
  status?(reportId: string, recipientId: string): Promise<"pending" | "sent" | null>;
  markSent?(reportId: string, recipientId: string, deliveredAt: string): Promise<void>;
}

export class InMemoryDeliveryLogStore implements DeliveryLogStore {
  private log = new Map<string, "pending" | "sent">();
  private key(reportId: string, recipientId: string): string {
    return `${reportId}::${recipientId}`;
  }
  async exists(reportId: string, recipientId: string): Promise<boolean> {
    return this.log.get(this.key(reportId, recipientId)) === "sent";
  }
  async record(entry: DeliveryLogEntry): Promise<void> {
    this.log.set(this.key(entry.reportId, entry.recipientId), entry.status ?? "sent");
  }
  async status(reportId: string, recipientId: string): Promise<"pending" | "sent" | null> {
    return this.log.get(this.key(reportId, recipientId)) ?? null;
  }
  async markSent(reportId: string, recipientId: string): Promise<void> {
    this.log.set(this.key(reportId, recipientId), "sent");
  }
}

export interface DeliveryDecision {
  shouldSend: boolean;
  subjectSuffix: string; // 再送時は "(再送)"、通常は ""
}

/**
 * PrjOps:SPEC-INT-052の冪等配信ロジック。isRetryAttempt=trueは「記録が失敗したため再送が許容される」経路
 * （記録は成功しているが呼び出し側が再試行しているケース）を表す。通常の初回送信ではfalseを渡す。
 */
export async function decideDelivery(
  store: DeliveryLogStore,
  reportId: string,
  recipientId: string,
  isRetryAttempt: boolean,
): Promise<DeliveryDecision> {
  const deliveryStatus = await store.status?.(reportId, recipientId);
  if (deliveryStatus === "pending") {
    return { shouldSend: true, subjectSuffix: "(再送)" };
  }
  if (deliveryStatus === "sent" && !isRetryAttempt) {
    return { shouldSend: false, subjectSuffix: "" };
  }
  if (deliveryStatus === "sent" && isRetryAttempt) {
    return { shouldSend: true, subjectSuffix: "(再送)" };
  }

  const alreadyDelivered = await store.exists(reportId, recipientId);
  if (alreadyDelivered && !isRetryAttempt) {
    return { shouldSend: false, subjectSuffix: "" };
  }
  if (alreadyDelivered && isRetryAttempt) {
    // 記録済みだが再送が明示的に要求されている（記録処理の失敗が疑われるケース）→ 件名に(再送)を付与して送る
    return { shouldSend: true, subjectSuffix: "(再送)" };
  }
  return { shouldSend: true, subjectSuffix: "" };
}
