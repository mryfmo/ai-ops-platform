// 根拠: ADR-0030 / ADR-0005 / FinalArch:FR-CP-001
// Jira deployment composition の環境設定を外部接続前に完全検証する純粋層。
import { isTemporalEnvironment, type JiraSyncExecutionMode, type TemporalEnvironment } from "@aiops/control-plane";

export interface CompositionConfig {
  readonly temporalAddress: string;
  readonly temporalEnvironment: TemporalEnvironment;
  readonly clientCertPath: string;
  readonly clientKeyPath: string;
  readonly serverRootCaPath: string;
  readonly authorizationTokenPath: string;
  readonly executionMode: JiraSyncExecutionMode;
}

type Environment = Readonly<Record<string, string | undefined>>;

function required(environment: Environment, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`E-JIRA-COMP-CONFIG: ${name} is required`);
  return value;
}

export function loadCompositionConfig(environment: Environment): CompositionConfig {
  const temporalEnvironment = required(environment, "JIRA_SYNC_TEMPORAL_ENVIRONMENT");
  if (!isTemporalEnvironment(temporalEnvironment)) {
    throw new Error("E-JIRA-COMP-CONFIG: JIRA_SYNC_TEMPORAL_ENVIRONMENT must be dev, staging, or prod");
  }
  const configuredMode = environment.JIRA_SYNC_EXECUTION_MODE?.trim() || "shadow";
  if (configuredMode !== "shadow" && configuredMode !== "live") {
    throw new Error("E-JIRA-COMP-CONFIG: JIRA_SYNC_EXECUTION_MODE must be shadow or live");
  }
  return {
    temporalAddress: required(environment, "JIRA_SYNC_TEMPORAL_ADDRESS"),
    temporalEnvironment,
    clientCertPath: required(environment, "JIRA_SYNC_TEMPORAL_CLIENT_CERT_PATH"),
    clientKeyPath: required(environment, "JIRA_SYNC_TEMPORAL_CLIENT_KEY_PATH"),
    serverRootCaPath: required(environment, "JIRA_SYNC_TEMPORAL_SERVER_ROOT_CA_PATH"),
    authorizationTokenPath: required(environment, "JIRA_SYNC_TEMPORAL_AUTHORIZATION_TOKEN_PATH"),
    executionMode: configuredMode === "live" ? "active" : "shadow",
  };
}
