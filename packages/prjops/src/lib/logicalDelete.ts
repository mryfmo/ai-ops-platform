/**
 * packages/prjops/src/lib/logicalDelete.ts
 *
 * 根拠: SPEC-INT-027 削除 / PrjOps:REQ-021 上書き・介入の記録 / AC-021-1
 *   「物理削除禁止。deleted: true の論理削除のみ。操作可能者はPRF-03、delete_reason必須」
 *   「理由未入力の上書き・削除操作はUIレベルで完了できない」
 *
 * 本モジュールは正本データの論理削除操作そのものを実行しない（実行はagents層がYAMLの
 * deletedフィールドを立てる処理として行う）。ここでは実行前提条件（権限・理由必須）の
 * 決定的な検証のみを提供する。
 */

import type { Profile } from "./reportJobStateMachine.js";
export type { Profile };

export interface LogicalDeleteRequest {
  requesterProfile: Profile;
  deleteReason: string | undefined;
}

export interface LogicalDeleteValidation {
  allowed: boolean;
  errors: string[];
}

/** SPEC-INT-027: PRF-03のみ実行可能、delete_reason必須 */
export function validateLogicalDeleteRequest(req: LogicalDeleteRequest): LogicalDeleteValidation {
  const errors: string[] = [];
  if (req.requesterProfile !== "PRF-03") {
    errors.push("この操作にはPRF-03権限が必要です（SPEC-INT-027）");
  }
  if (!req.deleteReason || req.deleteReason.trim().length === 0) {
    errors.push("delete_reasonは必須です（PrjOps:REQ-021 AC-021-1）");
  }
  return { allowed: errors.length === 0, errors };
}

/** 論理削除後のレコード形状（物理削除は行わない。SPEC-INT-027） */
export function applyLogicalDelete<T extends Record<string, unknown>>(
  record: T,
  deleteReason: string,
  deletedBy: string,
): T & { deleted: true; delete_reason: string; deleted_by: string; deleted_at: string } {
  return {
    ...record,
    deleted: true,
    delete_reason: deleteReason,
    deleted_by: deletedBy,
    deleted_at: new Date().toISOString(),
  };
}
