// 根拠: FinalArch:FR-CP-001 / FinalArch:CON-001 / ADR-0020
// activity の契約（型）のみを置く。実装（外部 I/O）は P3 帯で追加され、
// workflow コードはこのファイル以外の activities/* を import してはならない
// （workflow の決定性維持。tests/workflow-activity-separation.test.ts が機械検証）。

import type { OperationClass, VersionedPayload } from "../contracts/index.js";

/** すべての activity 実装が満たす契約の最小形。 */
export interface ActivityDefinition<TInput, TOutput> {
  readonly name: string;
  readonly operationClass: OperationClass;
  execute(input: VersionedPayload<TInput>): Promise<VersionedPayload<TOutput>>;
}
