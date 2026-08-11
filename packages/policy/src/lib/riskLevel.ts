// 根拠: FinalArch:CON-005, ADR-0023
import { RISK_LEVELS, type RiskLevel } from "../contracts.js";

export function isRiskLevel(value: unknown): value is RiskLevel {
  return typeof value === "string" && (RISK_LEVELS as readonly string[]).includes(value);
}
