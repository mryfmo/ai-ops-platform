// 根拠: FinalArch:CON-001 / FinalArch:CON-002 / ADR-0020
// 外部リソース参照の共通封筒。SoR の実 ID を型で包み、出所（system）を常に保持する。

import type { AdapterKind } from "./types.js";

export interface VersionedRef {
  readonly system: AdapterKind;
  readonly id: string;
  readonly version?: string;
}
