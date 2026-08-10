/**
 * packages/shared/src/migration/featureFlags.ts
 *
 * 根拠: FinalArch:FR-CP-008 / FinalArch:GOV-004 / FinalArch:GOV-005 / ADR-0020。
 *   最終アーキテクチャ移行の feature flag / kill-switch 契約（WBS P0-T08）。
 *   flag 定義の正本は docs/plans/2026-08-final-architecture/06_implementation/08_feature_flags.yaml。
 *   ここではその意味論（stage 遷移・immutable-off・相互排他・kill switch・fail closed）を
 *   型と実行時検証で強制する。
 *
 * lib分離（CLAUDE.md原則1・7）: env は引数注入。I/O なし。判定のみ。
 */

export const MIGRATION_STAGES = ["disabled", "shadow", "limited", "primary"] as const;
export type MigrationStage = (typeof MIGRATION_STAGES)[number];

export interface MigrationFlagDefinition {
  /** dotted 名（正本 YAML と一致）。env 名は AIOPS_FLAG_ + dotted を大文字 SNAKE 化。 */
  readonly name: string;
  readonly owner: string;
  /** この flag が取り得る stage。省略時は on/off（disabled|primary）二値。 */
  readonly stages?: readonly MigrationStage[];
  /** true なら AIOPS_FLAG_<NAME>_KILL=1 で無条件 disabled にできる。 */
  readonly killSwitch?: boolean;
  /** true なら永続 off。disabled 以外の値は設定エラー（E-FLAG02）。 */
  readonly immutableFalse?: boolean;
  /** この flag が primary のとき、相手は primary であってはならない。 */
  readonly mutuallyExclusivePrimaryWith?: string;
}

/** 正本 YAML（08_feature_flags.yaml）と同一の集合。追加・変更は正本を先に更新する。 */
export const MIGRATION_FLAGS: readonly MigrationFlagDefinition[] = [
  { name: "inference.litellm.enabled", owner: "ai-platform", stages: MIGRATION_STAGES, killSwitch: true },
  { name: "inference.anthropic_direct_fallback.enabled", owner: "security+ai-platform", killSwitch: true },
  {
    name: "control.temporal.enabled",
    owner: "control-plane",
    stages: MIGRATION_STAGES,
    killSwitch: true,
    mutuallyExclusivePrimaryWith: "control.legacy_scheduler.enabled",
  },
  {
    name: "control.legacy_scheduler.enabled",
    owner: "operations",
    mutuallyExclusivePrimaryWith: "control.temporal.enabled",
  },
  { name: "access.agentgateway.enabled", owner: "security", stages: MIGRATION_STAGES, killSwitch: true },
  { name: "policy.opa.enforce", owner: "security", stages: MIGRATION_STAGES, killSwitch: true },
  { name: "m365.workiq.read.enabled", owner: "m365", killSwitch: true },
  { name: "m365.workiq.write.enabled", owner: "m365+security" },
  { name: "teams.opentag_surface.enabled", owner: "product+m365" },
  { name: "web.workbench.capabilities.enabled", owner: "product+security" },
  { name: "meetings.wispr.enabled", owner: "data-owner" },
  { name: "knowledge.confluence_publish.enabled", owner: "knowledge-owner" },
  { name: "knowledge.sharepoint_formal_publish.enabled", owner: "records-owner" },
  { name: "coding.claude.enabled", owner: "github-owner" },
  { name: "coding.droid.enabled", owner: "github-owner" },
  { name: "coding.codex_review.enabled", owner: "github-owner" },
  { name: "aiops.incident_rca.enabled", owner: "operations", stages: MIGRATION_STAGES },
  { name: "aiops.auto_production_remediation.enabled", owner: "security", immutableFalse: true },
  { name: "cloudflare.artifacts.enabled", owner: "architecture", immutableFalse: true },
  { name: "notion.baseline.enabled", owner: "architecture", immutableFalse: true },
] as const;

export function migrationFlagEnvName(name: string): string {
  return `AIOPS_FLAG_${name.replaceAll(".", "_").toUpperCase()}`;
}

export type MigrationFlagStates = ReadonlyMap<string, MigrationStage>;

export interface MigrationFlagResolution {
  states: MigrationFlagStates;
  /** 設定エラー。1件でもあれば呼び出し側は起動を停止する（fail closed）。 */
  errors: string[];
}

/**
 * env から flag 状態を解決する。
 *
 * fail closed の規則:
 * - 未設定は常に disabled（旧経路は flag ではなく既存 config が統治する。PACK-05 の
 *   grandfather 規則により、本レジストリの disabled は「新経路を起動しない」ことだけを意味する）
 * - 未知の値・未知の AIOPS_FLAG_* 変数は設定エラー（黙殺しない）
 * - immutableFalse の flag へ disabled 以外を与えるのは設定エラー（E-FLAG02）
 * - kill switch は stage 設定より強い（監査は呼び出し側で行う）
 * - 相互排他: 双方 primary は設定エラー（E-FLAG03）
 */
export function resolveMigrationFlags(env: Readonly<Record<string, string | undefined>>): MigrationFlagResolution {
  const errors: string[] = [];
  const states = new Map<string, MigrationStage>();
  const knownEnvNames = new Set<string>();

  for (const flag of MIGRATION_FLAGS) {
    const envName = migrationFlagEnvName(flag.name);
    knownEnvNames.add(envName);
    if (flag.killSwitch) knownEnvNames.add(`${envName}_KILL`);

    const raw = env[envName]?.trim();
    const allowed: readonly MigrationStage[] = flag.stages ?? ["disabled", "primary"];
    let stage: MigrationStage = "disabled";
    if (raw !== undefined && raw !== "") {
      if (!(MIGRATION_STAGES as readonly string[]).includes(raw)) {
        errors.push(`E-FLAG01: ${envName} has unknown stage "${raw}" (allowed: ${allowed.join("|")})`);
      } else if (!allowed.includes(raw as MigrationStage)) {
        errors.push(`E-FLAG01: ${envName} stage "${raw}" is not allowed for this flag (allowed: ${allowed.join("|")})`);
      } else {
        stage = raw as MigrationStage;
      }
    }
    if (flag.immutableFalse && stage !== "disabled") {
      errors.push(`E-FLAG02: ${envName} is immutable-off; remove the setting`);
      stage = "disabled";
    }
    if (flag.killSwitch && env[`${envName}_KILL`]?.trim() === "1") {
      stage = "disabled";
    }
    states.set(flag.name, stage);
  }

  for (const flag of MIGRATION_FLAGS) {
    const other = flag.mutuallyExclusivePrimaryWith;
    if (!other) continue;
    if (states.get(flag.name) === "primary" && states.get(other) === "primary") {
      errors.push(`E-FLAG03: ${flag.name} and ${other} must not both be primary`);
    }
  }

  for (const key of Object.keys(env)) {
    if (key.startsWith("AIOPS_FLAG_") && !knownEnvNames.has(key)) {
      errors.push(`E-FLAG04: unknown migration flag variable ${key}`);
    }
  }

  return { states, errors: errors.sort() };
}
