/** 根拠: FinalArch:GOV-005 — 正本と不一致な migration flag の反例。 */
export const MIGRATION_STAGES = ["disabled", "shadow", "primary"] as const;
export const MIGRATION_FLAGS = [
  {
    name: "control.temporal.enabled",
    owner: "wrong-owner",
    stages: MIGRATION_STAGES,
    killSwitch: true,
  },
] as const;
