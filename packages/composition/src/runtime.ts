/**
 * packages/composition/src/runtime.ts
 *
 * 根拠: ADR-0030 / ADR-0005 / FinalArch:FR-CP-001
 * telemetry bootstrap 後にだけ読み込む Temporal Jira runtime。
 */
import { readFileSync } from "node:fs";

import {
  buildConnectionProfile,
  Client,
  createTemporalConnection,
  WorkflowExecutionAlreadyStartedError,
  type TemporalConnectionProfile,
  type TemporalEnvironment,
  type TemporalMtlsCredentials,
} from "@aiops/control-plane";

import { loadCompositionConfig } from "./lib/config.js";
import { createJiraRuntimeSeams, type WorkflowStarter } from "./lib/jiraSync.js";

interface JiraRuntimeDependencies {
  readFile(path: string): string;
  buildConnectionProfile(
    environment: TemporalEnvironment,
    address: string,
    options: { workerName: string; taskQueue: "jira-sync" },
  ): TemporalConnectionProfile;
  createTemporalConnection(profile: TemporalConnectionProfile, credentials: TemporalMtlsCredentials): Promise<unknown>;
  createWorkflowStarter(connection: unknown, namespace: string): WorkflowStarter;
}

function credential(readFile: (path: string) => string, path: string, name: string): string {
  let value: string;
  try {
    value = readFile(path);
  } catch (error) {
    throw new Error(
      `E-JIRA-COMP-CONFIG: ${name} file could not be read: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  if (!value.trim()) throw new Error(`E-JIRA-COMP-CONFIG: ${name} file is empty`);
  return value;
}

export async function createJiraRuntime(
  environment: Readonly<Record<string, string | undefined>>,
  dependencies: JiraRuntimeDependencies,
): Promise<ReturnType<typeof createJiraRuntimeSeams>> {
  const config = loadCompositionConfig(environment);
  const profile = dependencies.buildConnectionProfile(config.temporalEnvironment, config.temporalAddress, {
    workerName: "jira-composition",
    taskQueue: "jira-sync",
  });
  const credentials: TemporalMtlsCredentials = {
    clientCertPem: credential(dependencies.readFile, config.clientCertPath, "JIRA_SYNC_TEMPORAL_CLIENT_CERT_PATH"),
    clientKeyPem: credential(dependencies.readFile, config.clientKeyPath, "JIRA_SYNC_TEMPORAL_CLIENT_KEY_PATH"),
    serverRootCaPem: credential(
      dependencies.readFile,
      config.serverRootCaPath,
      "JIRA_SYNC_TEMPORAL_SERVER_ROOT_CA_PATH",
    ),
    authorizationTokenProvider: () =>
      credential(
        dependencies.readFile,
        config.authorizationTokenPath,
        "JIRA_SYNC_TEMPORAL_AUTHORIZATION_TOKEN_PATH",
      ).trim(),
  };
  const connection = await dependencies.createTemporalConnection(profile, credentials);
  return createJiraRuntimeSeams(
    dependencies.createWorkflowStarter(connection, profile.namespace),
    config.executionMode,
  );
}

export const productionJiraRuntimeDependencies: JiraRuntimeDependencies = {
  readFile: (path) => readFileSync(path, "utf8"),
  buildConnectionProfile,
  createTemporalConnection,
  createWorkflowStarter(connection, namespace): WorkflowStarter {
    const client = new Client({
      connection: connection as Awaited<ReturnType<typeof createTemporalConnection>>,
      namespace,
    });
    return {
      async start(workflow, options): Promise<void> {
        try {
          await client.workflow.start(workflow, options);
        } catch (error) {
          if (!(error instanceof WorkflowExecutionAlreadyStartedError)) throw error;
        }
      },
    };
  },
};
