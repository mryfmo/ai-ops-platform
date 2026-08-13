/**
 * packages/control-plane/tests/temporalProfile.test.ts
 *
 * 根拠: FinalArch:TMP-001 / FinalArch:FR-CP-001..008 / ADR-0021 / ENV-DEC-001（P3-T01）。
 * 接続プロファイル・mTLS identity 規約・client 側 fail-closed guard を検証する。
 * 証明書はテスト実行時に openssl で生成する（秘密鍵をリポジトリへ置かない）。
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { WORKFLOW_KINDS } from "../src/contracts/index.js";
import {
  allTaskQueues,
  assertCertificateMatchesProfile,
  buildConnectionProfile,
  namespaceFor,
  parseWorkerCertificateIdentity,
  taskQueueFor,
} from "../src/lib/temporalProfile.js";
import { createTemporalConnection } from "../src/temporal/connection.js";
import { createScopedWorker, refreshWorkerAuthorization } from "../src/temporal/worker.js";
import { assertTokenMatchesProfile, decodeAuthorizationToken } from "../src/lib/temporalProfile.js";

const workDir = mkdtempSync(join(tmpdir(), "p3t01-certs-"));

const b64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
function testToken(sub: string, permissions: string[], expDeltaSeconds = 3600): string {
  const payload = { sub, iss: "test", iat: 0, exp: Math.floor(Date.now() / 1000) + expDeltaSeconds, permissions };
  return `${b64url({ alg: "RS256" })}.${b64url(payload)}.sig`;
}
afterAll(() => rmSync(workDir, { recursive: true, force: true }));

interface IssuedCert {
  certPem: string;
  keyPem: string;
  caPem: string;
}

function issueWorkerCert(env: string, options: { caCn?: string; cn?: string; days?: number } = {}): IssuedCert {
  const caCn = options.caCn ?? `aiops-temporal-ca.${env}`;
  const cn = options.cn ?? `aiops-temporal-worker.${env}`;
  const days = options.days ?? 2;
  const id = `${env}-${Math.abs(Date.now() ^ Math.floor(Math.random() * 1e9))}`;
  const caKey = join(workDir, `${id}-ca.key`);
  const caCert = join(workDir, `${id}-ca.crt`);
  const key = join(workDir, `${id}.key`);
  const csr = join(workDir, `${id}.csr`);
  const cert = join(workDir, `${id}.crt`);
  execFileSync("openssl", [
    "req",
    "-x509",
    "-newkey",
    "ec",
    "-pkeyopt",
    "ec_paramgen_curve:P-256",
    "-nodes",
    "-keyout",
    caKey,
    "-out",
    caCert,
    "-days",
    "3",
    "-subj",
    `/CN=${caCn}`,
  ]);
  execFileSync("openssl", [
    "req",
    "-newkey",
    "ec",
    "-pkeyopt",
    "ec_paramgen_curve:P-256",
    "-nodes",
    "-keyout",
    key,
    "-out",
    csr,
    "-subj",
    `/CN=${cn}`,
  ]);
  execFileSync("openssl", [
    "x509",
    "-req",
    "-in",
    csr,
    "-CA",
    caCert,
    "-CAkey",
    caKey,
    "-CAcreateserial",
    "-out",
    cert,
    "-days",
    String(days),
  ]);
  return {
    certPem: readFileSync(cert, "utf8"),
    keyPem: readFileSync(key, "utf8"),
    caPem: readFileSync(caCert, "utf8"),
  };
}

describe("Temporal connection profile [FinalArch:TMP-001][FinalArch:FR-CP-001]", () => {
  it("namespace は environment 単位、worker は単一 task queue + 個体名にスコープ [FinalArch:FR-CP-001]", () => {
    const profile = buildConnectionProfile("dev", "127.0.0.1:7233", { workerName: "w1", taskQueue: "incident" });
    expect(profile.namespace).toBe("aiops-dev");
    expect(namespaceFor("prod")).toBe("aiops-prod");
    expect(profile.taskQueue).toBe("incident");
    expect(profile.workerName).toBe("w1");
    expect(profile.workerIdentity).toBe("aiops-temporal-worker.dev.w1");
    expect(allTaskQueues()).toEqual(WORKFLOW_KINDS.map(taskQueueFor));
  });

  it("不正な environment / address / workerName / taskQueue は E-TMP01 で拒否する [FinalArch:TMP-001]", () => {
    const opts = { workerName: "w1", taskQueue: "incident" as const };
    expect(() => buildConnectionProfile("qa" as never, "127.0.0.1:7233", opts)).toThrow(/E-TMP01/);
    expect(() => buildConnectionProfile("dev", "not a host", opts)).toThrow(/E-TMP01/);
    expect(() => buildConnectionProfile("dev", "http://x:7233", opts)).toThrow(/E-TMP01/);
    expect(() =>
      buildConnectionProfile("dev", "127.0.0.1:7233", { workerName: "bad name", taskQueue: "incident" }),
    ).toThrow(/workerName/);
    expect(() =>
      buildConnectionProfile("dev", "127.0.0.1:7233", { workerName: "w1", taskQueue: "not-a-kind" as never }),
    ).toThrow(/taskQueue/);
  });
});

describe("worker certificate identity [FinalArch:TMP-001 / ENV-DEC-001]", () => {
  const now = new Date();

  it("命名規約どおりの証明書を受理し identity を返す", () => {
    const issued = issueWorkerCert("dev");
    const identity = parseWorkerCertificateIdentity(issued.certPem, now);
    expect(identity.environment).toBe("dev");
    expect(identity.commonName).toBe("aiops-temporal-worker.dev");
    expect(identity.issuerCommonName).toBe("aiops-temporal-ca.dev");
  });

  it("CN 規約違反・未知 env・issuer 不整合・期限切れ・非 PEM を拒否する", () => {
    expect(() => parseWorkerCertificateIdentity("not-a-pem", now)).toThrow(/E-TMP01/);
    const badCn = issueWorkerCert("dev", { cn: "some-other-client.dev" });
    expect(() => parseWorkerCertificateIdentity(badCn.certPem, now)).toThrow(/CN must be/);
    const badEnv = issueWorkerCert("qa");
    expect(() => parseWorkerCertificateIdentity(badEnv.certPem, now)).toThrow(/E-TMP01/);
    const badIssuer = issueWorkerCert("dev", { caCn: "aiops-temporal-ca.staging" });
    expect(() => parseWorkerCertificateIdentity(badIssuer.certPem, now)).toThrow(/issuer must be/);
    const expired = issueWorkerCert("dev");
    expect(() =>
      parseWorkerCertificateIdentity(expired.certPem, new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)),
    ).toThrow(/expired/);
  });

  it("profile と証明書 environment の不整合は接続前に拒否する（client 側 fail-closed）", () => {
    const staging = issueWorkerCert("staging");
    const identity = parseWorkerCertificateIdentity(staging.certPem, now);
    const devProfile = buildConnectionProfile("dev", "127.0.0.1:7233", { workerName: "w1", taskQueue: "incident" });
    expect(() => assertCertificateMatchesProfile(devProfile, identity)).toThrow(/does not match profile/);
  });
});

describe("createTemporalConnection [FinalArch:TMP-001]", () => {
  it("guard 通過後に mTLS 資格と identity metadata を connect へ渡す", async () => {
    const issued = issueWorkerCert("dev");
    const profile = buildConnectionProfile("dev", "127.0.0.1:7233", { workerName: "w1", taskQueue: "incident" });
    const calls: unknown[] = [];
    const fake = { fake: true } as never;
    const connection = await createTemporalConnection(
      profile,
      {
        clientCertPem: issued.certPem,
        clientKeyPem: issued.keyPem,
        serverRootCaPem: issued.caPem,
        authorizationTokenProvider: () => testToken("aiops-temporal-worker.dev.w1", ["aiops-dev:write"]),
      },
      async (options) => {
        calls.push(options);
        return fake;
      },
    );
    expect(connection).toBe(fake);
    expect(calls).toHaveLength(1);
    const options = calls[0] as {
      address: string;
      apiKey: () => string;
      tls: { serverRootCACertificate: Buffer; clientCertPair: { crt: Buffer; key: Buffer } };
      metadata: Record<string, string>;
    };
    expect(options.address).toBe("127.0.0.1:7233");
    expect(typeof options.apiKey).toBe("function");
    expect(options.apiKey()).toContain(".");
    expect(options.tls.clientCertPair.crt.toString()).toBe(issued.certPem);
    expect(options.metadata["aiops-worker-identity"]).toBe("aiops-temporal-worker.dev.w1");
  });

  it("environment 不整合の資格・トークン欠落は connect を呼ばずに拒否する", async () => {
    const staging = issueWorkerCert("staging");
    const dev = issueWorkerCert("dev");
    const profile = buildConnectionProfile("dev", "127.0.0.1:7233", { workerName: "w1", taskQueue: "incident" });
    let called = 0;
    const noCall = async () => {
      called += 1;
      return {} as never;
    };
    await expect(
      createTemporalConnection(
        profile,
        {
          clientCertPem: staging.certPem,
          clientKeyPem: staging.keyPem,
          serverRootCaPem: staging.caPem,
          authorizationTokenProvider: () => testToken("aiops-temporal-worker.staging.w1", ["aiops-staging:write"]),
        },
        noCall,
      ),
    ).rejects.toThrow(/E-TMP01/);
    await expect(
      createTemporalConnection(
        profile,
        {
          clientCertPem: dev.certPem,
          clientKeyPem: dev.keyPem,
          serverRootCaPem: dev.caPem,
          authorizationTokenProvider: () => " ",
        },
        noCall,
      ),
    ).rejects.toThrow(/authorization token provider returned an empty token/);
    expect(called).toBe(0);
  });
});

describe("authorization token binding [FinalArch:TMP-001 / ENV-DEC-001 改訂]", () => {
  const profile = () => buildConnectionProfile("dev", "127.0.0.1:7233", { workerName: "w1", taskQueue: "incident" });

  it("worker 個体 sub と自 namespace write のみを受理する", () => {
    const payload = decodeAuthorizationToken(
      testToken("aiops-temporal-worker.dev.w1", ["aiops-dev:write"]),
      new Date(),
    );
    expect(() => assertTokenMatchesProfile(profile(), payload)).not.toThrow();
  });

  it("sub 不一致・越権 permission・期限切れ・非 JWT を拒否する", () => {
    const now = new Date();
    const other = decodeAuthorizationToken(testToken("aiops-temporal-worker.dev.w2", ["aiops-dev:write"]), now);
    expect(() => assertTokenMatchesProfile(profile(), other)).toThrow(/sub/);
    const admin = decodeAuthorizationToken(
      testToken("aiops-temporal-worker.dev.w1", ["aiops-dev:write", "aiops-dev:admin"]),
      now,
    );
    expect(() => assertTokenMatchesProfile(profile(), admin)).toThrow(/permissions/);
    const cross = decodeAuthorizationToken(testToken("aiops-temporal-worker.dev.w1", ["aiops-shadow:write"]), now);
    expect(() => assertTokenMatchesProfile(profile(), cross)).toThrow(/permissions/);
    expect(() => decodeAuthorizationToken(testToken("s", ["p"], -10), now)).toThrow(/expired/);
    expect(() => decodeAuthorizationToken("not-a-jwt", now)).toThrow(/must be a JWT/);
  });

  it("rotation 後のトークンも RPC 毎に検証され、束縛違反は SDK に渡らない（P3-T01-010）", async () => {
    const issued = issueWorkerCert("dev");
    let current = testToken("aiops-temporal-worker.dev.w1", ["aiops-dev:write"]);
    const captured: Array<() => string> = [];
    await createTemporalConnection(
      profile(),
      {
        clientCertPem: issued.certPem,
        clientKeyPem: issued.keyPem,
        serverRootCaPem: issued.caPem,
        authorizationTokenProvider: () => current,
      },
      async (options) => {
        captured.push(options.apiKey as () => string);
        return {} as never;
      },
    );
    const apiKey = captured[0]!;
    // 正常 rotation（同一 sub・同一権限）は新値が通る
    const rotated = testToken("aiops-temporal-worker.dev.w1", ["aiops-dev:write"], 7200);
    current = rotated;
    expect(apiKey()).toBe(rotated);
    // 束縛違反 rotation はすべて SDK に渡る前に E-TMP01 で遮断される
    current = testToken("aiops-temporal-worker.dev.w2", ["aiops-dev:write"]);
    expect(() => apiKey()).toThrow(/sub/);
    current = testToken("aiops-temporal-worker.dev.w1", ["aiops-dev:write", "temporal-system:admin"]);
    expect(() => apiKey()).toThrow(/permissions/);
    current = testToken("aiops-temporal-worker.dev.w1", ["aiops-shadow:write"]);
    expect(() => apiKey()).toThrow(/permissions/);
    current = testToken("aiops-temporal-worker.dev.w1", ["aiops-dev:write"], -10);
    expect(() => apiKey()).toThrow(/expired/);
    current = " ";
    expect(() => apiKey()).toThrow(/empty token/);
  });
});

describe("createScopedWorker [FinalArch:TMP-001 (P3-T01-006)]", () => {
  const profile = () => buildConnectionProfile("dev", "127.0.0.1:7233", { workerName: "w1", taskQueue: "incident" });
  const creds = () => {
    const issued = issueWorkerCert("dev");
    return {
      clientCertPem: issued.certPem,
      clientKeyPem: issued.keyPem,
      serverRootCaPem: issued.caPem,
      authorizationTokenProvider: () => testToken("aiops-temporal-worker.dev.w1", ["aiops-dev:write"]),
    };
  };

  it("namespace / taskQueue / identity は profile が唯一の出所になる", async () => {
    const workerOptions: unknown[] = [];
    const fakeConnection = { setApiKey: async () => undefined } as never;
    const { worker } = await createScopedWorker(
      profile(),
      creds(),
      { activities: { noop: async () => undefined } },
      async () => fakeConnection,
      async (options) => {
        workerOptions.push(options);
        return { fake: true } as never;
      },
    );
    expect(worker).toEqual({ fake: true });
    const options = workerOptions[0] as { namespace: string; taskQueue: string; identity: string };
    expect(options.namespace).toBe("aiops-dev");
    expect(options.taskQueue).toBe("incident");
    expect(options.identity).toBe("aiops-temporal-worker.dev.w1");
  });

  it("呼び出し側の namespace / taskQueue 上書きは実行時拒否する", async () => {
    await expect(
      createScopedWorker(
        profile(),
        creds(),
        { taskQueue: "meeting" } as never,
        async () => ({}) as never,
        async () => ({}) as never,
      ),
    ).rejects.toThrow(/must not be overridden/);
  });

  it("refreshWorkerAuthorization は検証済みトークンで setApiKey を呼ぶ", async () => {
    const applied: string[] = [];
    const token = testToken("aiops-temporal-worker.dev.w1", ["aiops-dev:write"]);
    await refreshWorkerAuthorization(
      profile(),
      { setApiKey: async (value: string) => void applied.push(value) },
      { authorizationTokenProvider: () => token },
    );
    expect(applied).toEqual([token]);
    await expect(
      refreshWorkerAuthorization(
        profile(),
        { setApiKey: async () => undefined },
        { authorizationTokenProvider: () => testToken("aiops-temporal-worker.dev.w2", ["aiops-dev:write"]) },
      ),
    ).rejects.toThrow(/sub/);
  });
});
