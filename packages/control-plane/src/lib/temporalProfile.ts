/**
 * packages/control-plane/src/lib/temporalProfile.ts
 *
 * 根拠: FinalArch:TMP-001 / FinalArch:FR-CP-001..008 / ADR-0021 / ENV-DEC-001（案 B'）。
 *   Temporal 接続プロファイルの純粋ロジック（P3-T01）。
 *   - namespace は environment 単位（`aiops-<env>`）。dev/staging/prod を混在させない
 *   - task queue は正典 workflow kind と 1:1（FR-CP-001 の kind 体系を唯一の語彙とする）
 *   - worker の mTLS 証明書 identity は `aiops-temporal-worker.<env>` 形式の CN を持ち、
 *     発行 CA は `aiops-temporal-ca.<env>`。profile と証明書の environment 不整合は
 *     接続前に fail-closed（E-TMP01）。server 側の environment 強制は per-env CA が担い、
 *     namespace/task-queue/非 admin の server 側 claim 強制は P3 帯 follow-up
 *     （custom claim mapper）— 本 guard はその client 側の防衛層
 *
 * lib分離（CLAUDE.md原則1）: 本ファイルは Temporal SDK・ネットワーク・fs に依存しない。
 * X509 の解析は node:crypto の X509Certificate（純関数的に PEM 文字列を受ける）のみ使う。
 */
import { X509Certificate } from "node:crypto";
import { WORKFLOW_KINDS, type WorkflowKind } from "../contracts/index.js";

export const TEMPORAL_ENVIRONMENTS = ["dev", "staging", "prod"] as const;
export type TemporalEnvironment = (typeof TEMPORAL_ENVIRONMENTS)[number];

export const WORKER_CN_PREFIX = "aiops-temporal-worker";
export const CA_CN_PREFIX = "aiops-temporal-ca";

export function isTemporalEnvironment(value: unknown): value is TemporalEnvironment {
  return typeof value === "string" && (TEMPORAL_ENVIRONMENTS as readonly string[]).includes(value);
}

/** namespace は environment 単位で分離する（ENV-DEC-001 / P0-T09 マトリクス）。 */
export function namespaceFor(environment: TemporalEnvironment): string {
  return `aiops-${environment}`;
}

/** task queue は workflow kind と 1:1。別語彙の queue 名を発明しない。 */
export function taskQueueFor(kind: WorkflowKind): string {
  return kind;
}

export function allTaskQueues(): readonly string[] {
  return WORKFLOW_KINDS.map(taskQueueFor);
}

export interface TemporalConnectionProfile {
  environment: TemporalEnvironment;
  /** gRPC frontend（VPC 内部 / dev はローカル）。`host:port` 形式。 */
  address: string;
  namespace: string;
  /** ENV-DEC-001 + Owner 裁定 2026-08-13: worker は単一 task queue にスコープ
   * （queue 粒度は worker 構成 + client guard 担保。server 側は namespace + 非 admin を
   * 内部発行 JWT の authorizer が強制）。 */
  taskQueue: string;
  /** worker 個体名（JWT sub / 監査 identity。英数と - _ のみ、最大 64 文字）。 */
  workerName: string;
  /** Temporal client identity 文字列（監査・可観測性用。秘密ではない）。 */
  workerIdentity: string;
}

const ADDRESS_PATTERN = /^[A-Za-z0-9.-]+(?::\d{1,5})$/u;

const WORKER_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u;

export function buildConnectionProfile(
  environment: TemporalEnvironment,
  address: string,
  options: { workerName: string; taskQueue: WorkflowKind },
): TemporalConnectionProfile {
  if (!isTemporalEnvironment(environment)) {
    throw new Error(`E-TMP01: unknown Temporal environment: ${String(environment)}`);
  }
  if (!ADDRESS_PATTERN.test(address)) {
    throw new Error("E-TMP01: Temporal address must be host:port");
  }
  if (!WORKER_NAME_PATTERN.test(options.workerName)) {
    throw new Error("E-TMP01: workerName must be alphanumeric with - or _ (max 64 chars)");
  }
  if (!(WORKFLOW_KINDS as readonly string[]).includes(options.taskQueue)) {
    throw new Error(`E-TMP01: taskQueue must be a canonical workflow kind (got ${String(options.taskQueue)})`);
  }
  return {
    environment,
    address,
    namespace: namespaceFor(environment),
    taskQueue: taskQueueFor(options.taskQueue),
    workerName: options.workerName,
    workerIdentity: `${WORKER_CN_PREFIX}.${environment}.${options.workerName}`,
  };
}

export interface WorkerCertificateIdentity {
  commonName: string;
  environment: TemporalEnvironment;
  issuerCommonName: string;
  notAfter: Date;
}

function extractCommonName(subject: string): string | undefined {
  for (const line of subject.split("\n")) {
    const match = /^CN=(.+)$/u.exec(line.trim());
    if (match) return match[1];
  }
  return undefined;
}

/** worker クライアント証明書の identity を解析し、命名規約と有効期限を検証する。 */
export function parseWorkerCertificateIdentity(certPem: string, now: Date): WorkerCertificateIdentity {
  let cert: X509Certificate;
  try {
    cert = new X509Certificate(certPem);
  } catch {
    throw new Error("E-TMP01: worker certificate is not a valid X509 PEM");
  }
  const commonName = extractCommonName(cert.subject);
  const issuerCommonName = extractCommonName(cert.issuer);
  if (!commonName || !issuerCommonName) {
    throw new Error("E-TMP01: worker certificate must carry subject/issuer CN");
  }
  const cnMatch = new RegExp(`^${WORKER_CN_PREFIX}\\.([a-z]+)$`, "u").exec(commonName);
  if (!cnMatch || !isTemporalEnvironment(cnMatch[1])) {
    throw new Error(`E-TMP01: worker certificate CN must be ${WORKER_CN_PREFIX}.<env> (got ${commonName})`);
  }
  const environment = cnMatch[1] as TemporalEnvironment;
  if (issuerCommonName !== `${CA_CN_PREFIX}.${environment}`) {
    throw new Error(
      `E-TMP01: worker certificate issuer must be ${CA_CN_PREFIX}.${environment} (got ${issuerCommonName})`,
    );
  }
  const notAfter = new Date(cert.validTo);
  if (Number.isNaN(notAfter.getTime()) || notAfter.getTime() <= now.getTime()) {
    throw new Error("E-TMP01: worker certificate is expired or has an invalid validity window");
  }
  return { commonName, environment, issuerCommonName, notAfter };
}

/**
 * profile と証明書 identity の整合を接続前に検証する（client 側 fail-closed guard）。
 * environment 不整合の server 側強制は per-env CA（TLS handshake 拒否）が担う。
 */
export function assertCertificateMatchesProfile(
  profile: TemporalConnectionProfile,
  identity: WorkerCertificateIdentity,
): void {
  if (identity.environment !== profile.environment) {
    throw new Error(
      `E-TMP01: certificate environment ${identity.environment} does not match profile ${profile.environment}`,
    );
  }
  const expectedCn = `${WORKER_CN_PREFIX}.${profile.environment}`;
  if (identity.commonName !== expectedCn) {
    throw new Error(`E-TMP01: certificate CN ${identity.commonName} does not match ${expectedCn}`);
  }
}

export interface AuthorizationTokenPayload {
  sub: string;
  exp: number;
  permissions: readonly string[];
}

/** 内部発行 JWT の payload を復号する（署名検証は server の責務。ここでは worker 個体
 * identity との束縛と期限の client 側 fail-closed のみを行う）。 */
export function decodeAuthorizationToken(token: string, now: Date): AuthorizationTokenPayload {
  const parts = token.split(".");
  const payloadSegment = parts.length === 3 ? parts[1] : undefined;
  if (!payloadSegment) throw new Error("E-TMP01: authorization token must be a JWT");
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8"));
  } catch {
    throw new Error("E-TMP01: authorization token payload is not valid JSON");
  }
  const { sub, exp, permissions } = payload as { sub?: unknown; exp?: unknown; permissions?: unknown };
  if (typeof sub !== "string" || typeof exp !== "number" || !Array.isArray(permissions)) {
    throw new Error("E-TMP01: authorization token must carry sub/exp/permissions");
  }
  if (exp * 1000 <= now.getTime()) {
    throw new Error("E-TMP01: authorization token is expired");
  }
  return { sub, exp, permissions: permissions.map(String) };
}

/** token の sub と permissions を profile（worker 個体 + 自 namespace write のみ）へ束縛する。 */
export function assertTokenMatchesProfile(
  profile: TemporalConnectionProfile,
  payload: AuthorizationTokenPayload,
): void {
  if (payload.sub !== profile.workerIdentity) {
    throw new Error(`E-TMP01: token sub ${payload.sub} does not match worker identity ${profile.workerIdentity}`);
  }
  const allowed = `${profile.namespace}:write`;
  const foreign = payload.permissions.filter((permission) => permission !== allowed);
  if (!payload.permissions.includes(allowed) || foreign.length > 0) {
    throw new Error(
      `E-TMP01: worker token permissions must be exactly [${allowed}] (got ${payload.permissions.join(",")})`,
    );
  }
}
