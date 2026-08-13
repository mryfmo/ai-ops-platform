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

const workDir = mkdtempSync(join(tmpdir(), "p3t01-certs-"));
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
        authorizationToken: "header.payload.signature",
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
      apiKey: string;
      tls: { serverRootCACertificate: Buffer; clientCertPair: { crt: Buffer; key: Buffer } };
      metadata: Record<string, string>;
    };
    expect(options.address).toBe("127.0.0.1:7233");
    expect(options.apiKey).toBe("header.payload.signature");
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
          authorizationToken: "t",
        },
        noCall,
      ),
    ).rejects.toThrow(/E-TMP01/);
    await expect(
      createTemporalConnection(
        profile,
        { clientCertPem: dev.certPem, clientKeyPem: dev.keyPem, serverRootCaPem: dev.caPem, authorizationToken: " " },
        noCall,
      ),
    ).rejects.toThrow(/authorization token/);
    expect(called).toBe(0);
  });
});
