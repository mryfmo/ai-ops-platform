/**
 * packages/shared/src/migration/featureFlags.ts
 *
 * 根拠: FinalArch:FR-CP-008 / FinalArch:GOV-004 / FinalArch:GOV-005 / FinalArch:INV-013 / ADR-0020。
 *   最終アーキテクチャ移行の feature flag / kill-switch 契約（WBS P0-T08）。
 *   flag 定義の正本は docs/plans/2026-08-final-architecture/06_implementation/08_feature_flags.yaml。
 *   本レジストリは正本の全レコード（name / default / owner / stages / modes / kill_switch /
 *   immutable_false / mutually_exclusive_primary_with / requires / scope / note）の忠実な鏡であり、
 *   テストが正本 YAML を独立にパースして完全一致を検証する。値語彙は flag ごとに正本のものを使う
 *   （汎用語彙を発明しない）。
 *
 * lib分離（CLAUDE.md原則1・7）: env は引数注入。I/O なし。判定のみ。
 */

export interface MigrationFlagDefinition {
  /** dotted 名（正本 YAML と一致）。env 名は AIOPS_FLAG_ + dotted を大文字 SNAKE 化。 */
  readonly name: string;
  /** 正本 default。off は "false"。control.legacy_scheduler.enabled のみ "true"。 */
  readonly default: string;
  readonly owner: string;
  /** 段階導入 ladder（正本の値をそのまま）。off 値 "false" は暗黙に許可される。 */
  readonly stages?: readonly string[];
  /** 動作モード（正本の値をそのまま）。off 値 "false" は暗黙に許可される。 */
  readonly modes?: readonly string[];
  /** true なら AIOPS_FLAG_<NAME>_KILL=1 で無条件 "false" にできる。 */
  readonly killSwitch?: boolean;
  /** true なら永続 off。"false" 以外の値は設定エラー（E-FLAG02）。 */
  readonly immutableFalse?: boolean;
  /** 正本どおり宣言側にのみ持つ。宣言側が off でないとき、相手が "primary" なら E-FLAG03。 */
  readonly mutuallyExclusivePrimaryWith?: string;
  /** 有効化の前提条件（正本の記録。実行時強制は各消費側の責務）。 */
  readonly requires?: readonly string[];
  readonly scope?: string;
  readonly note?: string;
}

/** 正本 08_feature_flags.yaml の忠実な鏡。追加・変更は正本を先に更新する。 */
export const MIGRATION_FLAGS: readonly MigrationFlagDefinition[] = [
  {
    name: "inference.litellm.enabled",
    default: "false",
    owner: "ai-platform",
    stages: ["shadow", "limited", "primary"],
    killSwitch: true,
  },
  {
    name: "inference.anthropic_direct_fallback.enabled",
    default: "false",
    owner: "security+ai-platform",
    requires: ["classification<=internal", "explicit-provider-allow"],
    killSwitch: true,
  },
  {
    name: "control.temporal.enabled",
    default: "false",
    owner: "control-plane",
    stages: ["shadow", "limited", "primary"],
    killSwitch: true,
  },
  {
    name: "control.legacy_scheduler.enabled",
    default: "true",
    owner: "operations",
    mutuallyExclusivePrimaryWith: "control.temporal.enabled",
  },
  {
    name: "access.agentgateway.enabled",
    default: "false",
    owner: "security",
    stages: ["read-only", "draft", "limited-write"],
    killSwitch: true,
  },
  {
    name: "policy.opa.enforce",
    default: "false",
    owner: "security",
    modes: ["log-only", "enforce"],
    killSwitch: true,
  },
  {
    name: "m365.workiq.read.enabled",
    default: "false",
    owner: "m365",
    requires: ["delegated-user", "obo-conformance"],
    killSwitch: true,
  },
  {
    name: "m365.workiq.write.enabled",
    default: "false",
    owner: "m365+security",
    note: "Phase 2; not initial production",
  },
  {
    name: "teams.opentag_surface.enabled",
    default: "false",
    owner: "product+m365",
    scope: "allowlisted teams/channels",
  },
  { name: "web.workbench.capabilities.enabled", default: "false", owner: "product+security" },
  { name: "meetings.wispr.enabled", default: "false", owner: "data-owner", scope: "approved meeting classes only" },
  {
    name: "knowledge.confluence_publish.enabled",
    default: "false",
    owner: "knowledge-owner",
    requires: ["human-review"],
  },
  {
    name: "knowledge.sharepoint_formal_publish.enabled",
    default: "false",
    owner: "records-owner",
    requires: ["formal-approval"],
  },
  {
    name: "coding.claude.enabled",
    default: "false",
    owner: "github-owner",
    requires: ["branch-protection", "runner-e2e"],
  },
  {
    name: "coding.droid.enabled",
    default: "false",
    owner: "github-owner",
    requires: ["pinned-cli", "runner-e2e", "branch-protection"],
  },
  {
    name: "coding.codex_review.enabled",
    default: "false",
    owner: "github-owner",
    requires: ["read-only-review-contract"],
  },
  {
    name: "aiops.incident_rca.enabled",
    default: "false",
    owner: "operations",
    stages: ["shadow", "suggestion", "repair-pr"],
  },
  { name: "aiops.auto_production_remediation.enabled", default: "false", owner: "security", immutableFalse: true },
  { name: "cloudflare.artifacts.enabled", default: "false", owner: "architecture", immutableFalse: true },
  { name: "notion.baseline.enabled", default: "false", owner: "architecture", immutableFalse: true },
] as const;

export function migrationFlagEnvName(name: string): string {
  return `AIOPS_FLAG_${name.replaceAll(".", "_").toUpperCase()}`;
}

/** flag が env に受け付ける値集合（正本語彙 + boolean）。off の "false" は常に許可。 */
export function migrationFlagAllowedValues(flag: MigrationFlagDefinition): readonly string[] {
  if (flag.immutableFalse) return ["false"];
  if (flag.stages) return ["false", ...flag.stages];
  if (flag.modes) return ["false", ...flag.modes];
  return ["false", "true"];
}

/** flag 状態。値はその flag の正本語彙のいずれか（off は "false"）。 */
export type MigrationFlagStates = ReadonlyMap<string, string>;

export interface MigrationFlagResolution {
  states: MigrationFlagStates;
  /** 設定エラー。1件でもあれば呼び出し側は起動を停止する（fail closed）。 */
  errors: string[];
}

/**
 * env から flag 状態を解決する。
 *
 * fail closed の規則:
 * - 未設定・空文字は正本 default（legacy_scheduler のみ true、他は false）
 * - その flag の正本語彙にない値は E-FLAG01（他 flag の語彙・発明語彙を受け付けない）
 * - immutableFalse の flag へ "false" 以外を与えるのは E-FLAG02
 * - 相互排他（正本どおり宣言側で評価）: 宣言側が off でなく相手が "primary" なら E-FLAG03
 * - 未知の AIOPS_FLAG_* 変数は E-FLAG04（typo の黙殺禁止）
 * - kill switch 値文法: 未設定・""・"0" は不作動、"1" は強制 "false"、それ以外は E-FLAG05
 *   （不正値で有効のまま走らせない）
 */
export function resolveMigrationFlags(env: Readonly<Record<string, string | undefined>>): MigrationFlagResolution {
  const errors: string[] = [];
  const states = new Map<string, string>();
  const knownEnvNames = new Set<string>();

  for (const flag of MIGRATION_FLAGS) {
    const envName = migrationFlagEnvName(flag.name);
    knownEnvNames.add(envName);
    if (flag.killSwitch) knownEnvNames.add(`${envName}_KILL`);

    const allowed = migrationFlagAllowedValues(flag);
    const raw = env[envName]?.trim();
    let state = flag.default;
    if (raw !== undefined && raw !== "") {
      if (flag.immutableFalse && raw !== "false") {
        errors.push(`E-FLAG02: ${envName} is immutable-off; remove the setting`);
      } else if (!allowed.includes(raw)) {
        errors.push(`E-FLAG01: ${envName} has invalid value "${raw}" (allowed: ${allowed.join("|")})`);
      } else {
        state = raw;
      }
    }
    if (flag.killSwitch) {
      const kill = env[`${envName}_KILL`]?.trim();
      if (kill === "1") {
        state = "false";
      } else if (kill !== undefined && kill !== "" && kill !== "0") {
        errors.push(`E-FLAG05: ${envName}_KILL has invalid value "${kill}" (allowed: 1 to kill, 0/unset otherwise)`);
      }
    }
    states.set(flag.name, state);
  }

  for (const flag of MIGRATION_FLAGS) {
    const other = flag.mutuallyExclusivePrimaryWith;
    if (!other) continue;
    if (states.get(flag.name) !== "false" && states.get(other) === "primary") {
      errors.push(`E-FLAG03: ${flag.name} must be false while ${other} is primary (one-writer rule)`);
    }
  }

  for (const key of Object.keys(env)) {
    if (key.startsWith("AIOPS_FLAG_") && !knownEnvNames.has(key)) {
      errors.push(`E-FLAG04: unknown migration flag variable ${key}`);
    }
  }

  return { states, errors: errors.sort() };
}
