/**
 * packages/control-plane/src/temporal/connection.ts
 *
 * 根拠: FinalArch:TMP-001 / FinalArch:FR-CP-001..008 / ADR-0021 / ENV-DEC-001（P3-T01）。
 *   mTLS 前提の Temporal 接続 factory（薄い結線層）。判定はすべて lib/temporalProfile.ts の
 *   純関数に委譲し、本層は @temporalio/client への受け渡しのみを行う。
 *   資格（cert/key/CA の PEM）は呼び出し側が Secrets Manager / ローカル証明書ストアから
 *   読み込んで注入する（fs 読み込みを本層に置かない — CLAUDE.md原則7 DI）。
 */
import { Connection, type ConnectionOptions } from "@temporalio/client";
import {
  assertCertificateMatchesProfile,
  assertTokenMatchesProfile,
  decodeAuthorizationToken,
  parseWorkerCertificateIdentity,
  type TemporalConnectionProfile,
} from "../lib/temporalProfile.js";

export interface TemporalMtlsCredentials {
  /** worker クライアント証明書（PEM）。CN=aiops-temporal-worker.<env> */
  clientCertPem: string;
  /** worker クライアント秘密鍵（PEM） */
  clientKeyPem: string;
  /** 環境別 CA（PEM）。server 検証用 */
  serverRootCaPem: string;
  /** プラットフォーム内部発行の認可トークン（RS256 JWT）を返す provider。
   * client Connection では各 RPC で評価されるため、renewal 済みトークンを返せば
   * 再接続なしで認可が継続する（ENV-DEC-001 + Owner 裁定 2026-08-13。
   * Entra / 外部 IdP は関与しない）。 */
  authorizationTokenProvider: () => string;
}

export type TemporalConnectFn = (options: ConnectionOptions) => Promise<Connection>;

/**
 * mTLS 資格と profile の整合を検証してから Temporal frontend へ接続する。
 * - environment 不整合 / CN 規約違反 / 期限切れは接続前に E-TMP01 で fail-closed
 * - TLS なし・別 env CA の接続は server（per-env CA）が拒否する
 */
export async function createTemporalConnection(
  profile: TemporalConnectionProfile,
  credentials: TemporalMtlsCredentials,
  connectImpl: TemporalConnectFn = Connection.connect.bind(Connection),
  now: () => Date = () => new Date(),
): Promise<Connection> {
  const identity = parseWorkerCertificateIdentity(credentials.clientCertPem, now());
  assertCertificateMatchesProfile(profile, identity);
  const initialToken = validateTokenProvider(profile, credentials, now);
  void initialToken;
  return connectImpl({
    address: profile.address,
    // provider callback を渡す: SDK が RPC 毎に評価するため rotation が再接続なしで効く
    apiKey: credentials.authorizationTokenProvider,
    tls: {
      serverRootCACertificate: Buffer.from(credentials.serverRootCaPem),
      clientCertPair: {
        crt: Buffer.from(credentials.clientCertPem),
        key: Buffer.from(credentials.clientKeyPem),
      },
      // server 証明書は環境規約名で検証する（IP 直指定でも TLS 検証を弱めない）
      serverNameOverride: `aiops-temporal-frontend.${profile.environment}`,
    },
    metadata: { "aiops-worker-identity": profile.workerIdentity },
  });
}

/** provider の存在・初期トークンの形式/束縛を接続前に検証する（fail-closed）。 */
export function validateTokenProvider(
  profile: TemporalConnectionProfile,
  credentials: Pick<TemporalMtlsCredentials, "authorizationTokenProvider">,
  now: () => Date = () => new Date(),
): string {
  if (typeof credentials.authorizationTokenProvider !== "function") {
    throw new Error("E-TMP01: authorization token provider is required (server-side authorizer is mandatory)");
  }
  const token = credentials.authorizationTokenProvider();
  if (typeof token !== "string" || token.trim() === "") {
    throw new Error("E-TMP01: authorization token provider returned an empty token");
  }
  assertTokenMatchesProfile(profile, decodeAuthorizationToken(token, now()));
  return token;
}
