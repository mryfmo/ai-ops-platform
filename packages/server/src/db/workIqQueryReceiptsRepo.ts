/**
 * 根拠: ADR-0024 / WIQ-001 / WIQ-002 / WIQ-005 / DELTA-03
 * delegated `/m365/query` の metadata-only receipt。将来 gateway 経由へ移す場合は
 * policy_decision_id / trace_id で tool_invocations と相関し、両方へ二重記録しない。
 */
import type { PgQueryable } from "@aiops/shared";

import { sanitizeJsonDeep } from "./ledgerEvidenceRepos.js";

export interface WorkIqQueryReceipt {
  readonly receiptId: string;
  readonly subjectId: string;
  readonly tenantId: string;
  readonly tool: "ask" | "fetch";
  readonly questionHash: string | null;
  readonly sourceReferences: readonly Record<string, unknown>[];
  readonly permissionContext: Readonly<Record<string, unknown>> | null;
  readonly provenanceComplete: boolean;
  readonly decisionId: string | null;
  readonly status: "succeeded" | "failed" | "blocked";
  readonly errorCode: string | null;
  readonly traceId: string;
}

const SHA256 = /^[a-f0-9]{64}$/u;
const ERROR_CODE = /^E-[A-Z0-9-]+$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertReceipt(receipt: WorkIqQueryReceipt): void {
  const sourceReferences = receipt.sourceReferences;
  const permissionContext = receipt.permissionContext;
  const validQuestionHash =
    (receipt.tool === "ask" && typeof receipt.questionHash === "string" && SHA256.test(receipt.questionHash)) ||
    (receipt.tool === "fetch" && receipt.questionHash === null);
  const validResult =
    (receipt.status === "succeeded" && receipt.errorCode === null) ||
    (receipt.status !== "succeeded" && typeof receipt.errorCode === "string" && ERROR_CODE.test(receipt.errorCode));
  const validProvenance =
    !receipt.provenanceComplete ||
    (sourceReferences.length > 0 && permissionContext !== null && Object.keys(permissionContext).length > 0);

  if (
    receipt.subjectId.trim() === "" ||
    receipt.tenantId.trim() === "" ||
    receipt.traceId.trim() === "" ||
    !validQuestionHash ||
    !validResult ||
    !Array.isArray(sourceReferences) ||
    !sourceReferences.every(isRecord) ||
    (permissionContext !== null && !isRecord(permissionContext)) ||
    !validProvenance
  ) {
    throw new TypeError("E-WIQ-RECEIPT-INPUT: invalid Work IQ receipt metadata");
  }
}

export class WorkIqQueryReceiptsRepo {
  constructor(private readonly db: PgQueryable) {}

  async record(receipt: WorkIqQueryReceipt): Promise<void> {
    assertReceipt(receipt);
    await this.db.query(
      `INSERT INTO work_iq_query_receipts (
         receipt_id, subject_id, tenant_id, tool_name, question_hash, source_references,
         permission_context, provenance_complete, policy_decision_id, result_status,
         error_code, trace_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        receipt.receiptId,
        receipt.subjectId,
        receipt.tenantId,
        receipt.tool,
        receipt.questionHash,
        JSON.stringify(sanitizeJsonDeep(receipt.sourceReferences)),
        receipt.permissionContext === null ? null : JSON.stringify(sanitizeJsonDeep(receipt.permissionContext)),
        receipt.provenanceComplete,
        receipt.decisionId,
        receipt.status,
        receipt.errorCode,
        receipt.traceId,
      ],
    );
  }
}
