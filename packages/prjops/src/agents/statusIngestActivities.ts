// 根拠: PrjOps:REQ-004/005/020 / PrjOps:SPEC-INT-030 / FinalArch:ING-001
// Temporal activity は既存 PrjOps canonical writer・通知・append-only audit を薄く結線する。
import type { AuditLogWriter } from "@aiops/shared/auditLog.js";
import type { NormalizedStatusIngestEvent } from "@aiops/shared/reporting/statusIngestChannels.js";
import type { CompletenessResult } from "@aiops/shared/reporting/statusIngestContract.js";

export interface StatusIngestStore {
  readThread(threadKey: string): Promise<unknown>;
  claim(input: { event: NormalizedStatusIngestEvent; completeness: CompletenessResult }): Promise<unknown>;
  findSideEffect(idempotencyKey: string): Promise<unknown>;
  recordSideEffect(idempotencyKey: string, receipt: unknown): Promise<void>;
  complete(input: {
    sourceKey: string;
    expectedRevision: number;
    canonicalReference: string | null;
    notificationReference: string;
  }): Promise<unknown>;
}

interface StatusIngestActivityDependencies {
  readonly store: StatusIngestStore;
  readonly audit: AuditLogWriter;
  readonly canonical: (event: NormalizedStatusIngestEvent, idempotencyKey: string) => Promise<string>;
  readonly notify: (
    event: NormalizedStatusIngestEvent,
    action: "accept" | "clarify" | "escalate_incomplete",
    message: string,
    idempotencyKey: string,
  ) => Promise<string>;
  readonly now?: () => string;
}

type Envelope<T> = { readonly schemaVersion: 1; readonly payload: T };
type Action = "accept" | "clarify" | "escalate_incomplete";

function receipt(
  sourceKey: string,
  idempotencyKey: string,
  effect: "canonical" | "notification" | "audit",
  reference: string,
) {
  return { schemaVersion: 1 as const, payload: { sourceKey, idempotencyKey, effect, reference } };
}

/** Schema 実装を注入し、workflow activity surface だけを返す。 */
export function createStatusIngestActivities(deps: StatusIngestActivityDependencies) {
  return {
    async readStatusIngestThread(input: Envelope<{ threadKey: string }>) {
      return deps.store.readThread(input.payload.threadKey);
    },
    async claimStatusIngest(input: Envelope<{ event: NormalizedStatusIngestEvent; completeness: CompletenessResult }>) {
      return deps.store.claim(input.payload);
    },
    async findStatusIngestSideEffect(_input: Envelope<{ sourceKey: string }>, idempotencyKey: string) {
      const stored = await deps.store.findSideEffect(idempotencyKey);
      if (stored !== null) return stored;
      const audit = (await deps.audit.readAll()).find((record) => {
        const detail = record.detail as { idempotencyKey?: unknown } | null;
        return detail?.idempotencyKey === idempotencyKey;
      });
      return audit === undefined ? null : receipt(audit.trace_id, idempotencyKey, "audit", audit.action);
    },
    async persistCanonicalStatusUpdate(
      input: Envelope<{ sourceKey: string; event: NormalizedStatusIngestEvent }>,
      idempotencyKey: string,
    ) {
      const result = receipt(
        input.payload.sourceKey,
        idempotencyKey,
        "canonical",
        await deps.canonical(input.payload.event, idempotencyKey),
      );
      await deps.store.recordSideEffect(idempotencyKey, result);
      return result;
    },
    async sendStatusIngestNotification(
      input: Envelope<{
        sourceKey: string;
        event: NormalizedStatusIngestEvent;
        action: Action;
        message: string;
      }>,
      idempotencyKey: string,
    ) {
      const result = receipt(
        input.payload.sourceKey,
        idempotencyKey,
        "notification",
        await deps.notify(input.payload.event, input.payload.action, input.payload.message, idempotencyKey),
      );
      await deps.store.recordSideEffect(idempotencyKey, result);
      return result;
    },
    async appendStatusIngestAudit(
      input: Envelope<{
        sourceKey: string;
        threadKey: string;
        code: string;
        action: Action;
        duplicate: boolean;
        clarifyCount: number;
      }>,
      idempotencyKey: string,
    ) {
      const item = input.payload;
      await deps.audit.append({
        trace_id: item.sourceKey,
        actor: "AGT-02",
        action: item.code,
        basis: "FinalArch:ING-001",
        detail: {
          idempotencyKey,
          threadKey: item.threadKey,
          action: item.action,
          duplicate: item.duplicate,
          clarifyCount: item.clarifyCount,
        },
        at: deps.now?.() ?? new Date().toISOString(),
      });
      return receipt(item.sourceKey, idempotencyKey, "audit", item.code);
    },
    async completeStatusIngest(
      input: Envelope<{
        sourceKey: string;
        expectedRevision: number;
        canonicalReference: string | null;
        notificationReference: string;
      }>,
    ) {
      return deps.store.complete(input.payload);
    },
  };
}
