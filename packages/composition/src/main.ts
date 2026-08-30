/**
 * packages/composition/src/main.ts
 *
 * 根拠: ADR-0030 / ADR-0005 / FinalArch:FR-CP-001
 * server と Temporal control-plane の Jira seam を結線する実行専用 entry。
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  buildConnectionProfile,
  Client,
  createTemporalConnection,
  WorkflowExecutionAlreadyStartedError,
  type TemporalConnectionProfile,
  type TemporalEnvironment,
  type TemporalMtlsCredentials,
} from "@aiops/control-plane";
import { main as serverMain } from "@aiops/server";

import { loadCompositionConfig } from "./lib/config.js";
import { createJiraRuntimeSeams, type WorkflowStarter } from "./lib/jiraSync.js";

interface StartCompositionDependencies {
  readFile(path: string): string;
  buildConnectionProfile(
    environment: TemporalEnvironment,
    address: string,
    options: { workerName: string; taskQueue: "jira-sync" },
  ): TemporalConnectionProfile;
  createTemporalConnection(profile: TemporalConnectionProfile, credentials: TemporalMtlsCredentials): Promise<unknown>;
  createWorkflowStarter(connection: unknown, namespace: string): WorkflowStarter;
  serverMain(bootstrap: { jira: ReturnType<typeof createJiraRuntimeSeams> }): Promise<void>;
}

function credential(readFile: (path: string) => string, path: string, name: string): string {
  let value: string;
  try {
    value = readFile(path);
  } catch (error) {
    throw new Error(
      `E-JIRA-COMP-CONFIG: ${name} file could not be read: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!value.trim()) throw new Error(`E-JIRA-COMP-CONFIG: ${name} file is empty`);
  return value;
}

export async function startComposition(
  environment: Readonly<Record<string, string | undefined>>,
  dependencies: StartCompositionDependencies,
): Promise<void> {
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
  const starter = dependencies.createWorkflowStarter(connection, profile.namespace);
  await dependencies.serverMain({ jira: createJiraRuntimeSeams(starter, config.executionMode) });
}

const productionDependencies: StartCompositionDependencies = {
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
  serverMain,
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  startComposition(process.env, productionDependencies).catch((error) => {
    console.error(error instanceof Error ? error.message : "Jira composition startup failed");
    process.exitCode = 1;
  });
}
