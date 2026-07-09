/**
 * packages/prjops/src/lib/idempotentDelivery.ts
 *
 * 根拠: SPEC-INT-052 冪等配信 / REQ-018 AC-018-2
 *   配信前に prjops-reports/delivery_log/{RPT-id}.yaml の存在を確認し、存在すればスキップ。
 *   送信成功後に記録を書く（記録失敗時は再送許容だが件名 (再送) を付与）。
 *   SPEC-EXT-023: 重複して2通届くことはない。
 */

export interface DeliveryLogEntry {
  reportId: string;
  recipientId: string;
  deliveredAt: string;
}

export interface DeliveryLogStore {
  exists(reportId: string, recipientId: string): Promise<boolean>;
  record(entry: DeliveryLogEntry): Promise<void>;
}

export class InMemoryDeliveryLogStore implements DeliveryLogStore {
  private log = new Set<string>();
  private key(reportId: string, recipientId: string): string {
    return `${reportId}::${recipientId}`;
  }
  async exists(reportId: string, recipientId: string): Promise<boolean> {
    return this.log.has(this.key(reportId, recipientId));
  }
  async record(entry: DeliveryLogEntry): Promise<void> {
    this.log.add(this.key(entry.reportId, entry.recipientId));
  }
}

export interface DeliveryDecision {
  shouldSend: boolean;
  subjectSuffix: string; // 再送時は "(再送)"、通常は ""
}

/**
 * SPEC-INT-052の冪等配信ロジック。isRetryAttempt=trueは「記録が失敗したため再送が許容される」経路
 * （記録は成功しているが呼び出し側が再試行しているケース）を表す。通常の初回送信ではfalseを渡す。
 */
export async function decideDelivery(
  store: DeliveryLogStore,
  reportId: string,
  recipientId: string,
  isRetryAttempt: boolean,
): Promise<DeliveryDecision> {
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
