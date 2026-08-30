/**
 * packages/composition/src/main.ts
 *
 * 根拠: ADR-0030 / ADR-0005 / FinalArch:FR-CP-001
 * telemetry を先に起動し、server と Jira runtime を遅延 import する production entry。
 */
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createLogger, loadConfig, startTelemetry } from "@aiops/server/bootstrap";
import type { JiraRuntimeCompositionDeps } from "@aiops/server";

const SERVICE_VERSION = (createRequire(import.meta.url)("../package.json") as { version: string }).version;

type Environment = Readonly<Record<string, string | undefined>>;
type ServerConfig = ReturnType<typeof loadConfig>;
type Logger = ReturnType<typeof createLogger>;
type Telemetry = Awaited<ReturnType<typeof startTelemetry>>;
type JiraRuntime = Required<Pick<JiraRuntimeCompositionDeps, "dispatchJiraEvent" | "commitCompleteSnapshot">>;

interface EntryRuntime {
  createJiraRuntime(environment: Environment): Promise<JiraRuntime>;
  serverMain(bootstrap: {
    config: ServerConfig;
    logger: Logger;
    telemetry: Telemetry;
    jira?: JiraRuntime;
  }): Promise<void>;
}

interface CompositionEntryDependencies {
  loadConfig(environment: Environment): ServerConfig;
  createLogger(level: string): Logger;
  startTelemetry(
    options: {
      serviceName: string;
      serviceVersion: string;
      otlpEndpoint?: string;
      otlpTracesEndpoint?: string;
    },
    logger: Logger,
  ): Promise<Telemetry>;
  loadRuntime(): Promise<EntryRuntime>;
}

export async function startCompositionEntry(
  environment: Environment,
  dependencies: CompositionEntryDependencies,
): Promise<void> {
  const config = dependencies.loadConfig(environment);
  const logger = dependencies.createLogger(config.LOG_LEVEL);
  const telemetry = await dependencies.startTelemetry(
    {
      serviceName: config.OTEL_SERVICE_NAME,
      serviceVersion: SERVICE_VERSION,
      otlpEndpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT,
      otlpTracesEndpoint: config.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
    },
    logger,
  );
  const runtime = await dependencies.loadRuntime();
  const bootstrap = { config, logger, telemetry };
  if (!config.JIRA_ENVIRONMENT_MAPPING_PATH) {
    await runtime.serverMain(bootstrap);
    return;
  }
  await runtime.serverMain({ ...bootstrap, jira: await runtime.createJiraRuntime(environment) });
}

const productionDependencies: CompositionEntryDependencies = {
  loadConfig: (environment) => loadConfig(environment),
  createLogger,
  startTelemetry,
  async loadRuntime(): Promise<EntryRuntime> {
    const [runtime, server] = await Promise.all([import("./runtime.js"), import("@aiops/server")]);
    return {
      createJiraRuntime: (environment) =>
        runtime.createJiraRuntime(environment, runtime.productionJiraRuntimeDependencies),
      serverMain: server.main,
    };
  },
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  startCompositionEntry(process.env, productionDependencies).catch((error) => {
    createLogger(process.env.LOG_LEVEL ?? "info").error(
      { err: error instanceof Error ? error.message : String(error) },
      "fatal startup error",
    );
    process.exit(1);
  });
}
