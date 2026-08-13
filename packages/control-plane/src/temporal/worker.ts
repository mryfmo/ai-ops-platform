/**
 * packages/control-plane/src/temporal/worker.ts
 *
 * 根拠: FinalArch:TMP-001 / FinalArch:FR-CP-001..008 / ADR-0021 / ENV-DEC-001
 *   （改訂 2026-08-13）。task-queue スコープの**実効的な** client 側強制点（P3-T01-006）。
 *   Worker は本 factory 経由でのみ構築し、namespace / taskQueue は profile が唯一の
 *   出所（呼び出し側の上書きは実行時拒否）。認可トークンは provider から供給し、
 *   `refreshWorkerAuthorization()` で稼働中の rotation に対応する（P3-T01-007）。
 */
import { NativeConnection, Worker, type NativeConnectionOptions, type WorkerOptions } from "@temporalio/worker";
import {
  assertCertificateMatchesProfile,
  parseWorkerCertificateIdentity,
  type TemporalConnectionProfile,
} from "../lib/temporalProfile.js";
import { validateTokenProvider, type TemporalMtlsCredentials } from "./connection.js";

/** namespace / taskQueue / 接続資格は profile と credentials が唯一の出所。 */
export type ScopedWorkerOptions = Omit<WorkerOptions, "connection" | "namespace" | "taskQueue" | "identity">;

export interface ScopedWorker {
  worker: Worker;
  connection: NativeConnection;
}

export type NativeConnectFn = (options: NativeConnectionOptions) => Promise<NativeConnection>;
export type WorkerCreateFn = (options: WorkerOptions) => Promise<Worker>;

/**
 * profile にスコープされた Temporal Worker を構築する。
 * - mTLS 証明書 / 認可トークンは接続前に profile と束縛検証（E-TMP01 fail-closed）
 * - namespace / taskQueue の呼び出し側上書きは実行時拒否
 */
export async function createScopedWorker(
  profile: TemporalConnectionProfile,
  credentials: TemporalMtlsCredentials,
  options: ScopedWorkerOptions,
  connectImpl: NativeConnectFn = NativeConnection.connect.bind(NativeConnection),
  createImpl: WorkerCreateFn = Worker.create.bind(Worker),
  now: () => Date = () => new Date(),
): Promise<ScopedWorker> {
  const identity = parseWorkerCertificateIdentity(credentials.clientCertPem, now());
  assertCertificateMatchesProfile(profile, identity);
  const initialToken = validateTokenProvider(profile, credentials, now);
  for (const forbidden of ["connection", "namespace", "taskQueue", "identity"] as const) {
    if (forbidden in (options as Record<string, unknown>)) {
      throw new Error(`E-TMP01: ${forbidden} is derived from the connection profile and must not be overridden`);
    }
  }
  const connection = await connectImpl({
    address: profile.address,
    apiKey: initialToken,
    tls: {
      serverRootCACertificate: Buffer.from(credentials.serverRootCaPem),
      clientCertPair: {
        crt: Buffer.from(credentials.clientCertPem),
        key: Buffer.from(credentials.clientKeyPem),
      },
      serverNameOverride: `aiops-temporal-frontend.${profile.environment}`,
    },
  });
  const worker = await createImpl({
    ...options,
    connection,
    namespace: profile.namespace,
    taskQueue: profile.taskQueue,
    identity: profile.workerIdentity,
  });
  return { worker, connection };
}

/**
 * 稼働中 worker の認可トークンを provider の現在値へ更新する（12h TTL の renewal。
 * 署名鍵は worker へ配布しない — 発行は運用側 mint、worker は受領のみ）。
 */
export async function refreshWorkerAuthorization(
  profile: TemporalConnectionProfile,
  connection: Pick<NativeConnection, "setApiKey">,
  credentials: Pick<TemporalMtlsCredentials, "authorizationTokenProvider">,
  now: () => Date = () => new Date(),
): Promise<void> {
  const token = validateTokenProvider(profile, credentials, now);
  await connection.setApiKey(token);
}
