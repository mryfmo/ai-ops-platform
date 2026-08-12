// 根拠: FinalArch:TMP-001 / ENV-DEC-001（P3-T01 verification client）
// smoke.sh から呼ばれる。@aiops/control-plane（ビルド済み dist）で mTLS 接続と
// 拒否マトリクスを検証する。リトライで auto-setup の起動完了（~60s）を待つ。
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { buildConnectionProfile, createTemporalConnection } from "../../packages/control-plane/dist/index.js";

// @temporalio/client は control-plane の依存として解決する（root には置かない）
const requireFromControlPlane = createRequire(new URL("../../packages/control-plane/package.json", import.meta.url));
const { Connection } = requireFromControlPlane("@temporalio/client");

const address = process.env.TEMPORAL_SMOKE_ADDRESS;
const certDir = process.env.TEMPORAL_SMOKE_CERT_DIR;
if (!address || !certDir) throw new Error("TEMPORAL_SMOKE_ADDRESS and TEMPORAL_SMOKE_CERT_DIR are required");

const creds = (env) => ({
  clientCertPem: readFileSync(join(certDir, env, "worker.crt"), "utf8"),
  clientKeyPem: readFileSync(join(certDir, env, "worker.key"), "utf8"),
  serverRootCaPem: readFileSync(join(certDir, env, "ca.crt"), "utf8"),
});

const profile = buildConnectionProfile("dev", address);

// 1) 正常系: dev worker cert で接続し namespace describe（auto-setup 完了までリトライ）
let connection;
for (let attempt = 1; attempt <= 40; attempt += 1) {
  try {
    connection = await createTemporalConnection(profile, creds("dev"), (options) =>
      Connection.connect({ ...options, connectTimeout: 5000 }),
    );
    break;
  } catch (error) {
    if (attempt === 40) throw error;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}
// auto-setup の namespace 登録は非同期（cache refresh 含め最大 ~90s）なのでリトライする
let described;
for (let attempt = 1; attempt <= 30; attempt += 1) {
  try {
    described = await connection.workflowService.describeNamespace({ namespace: "aiops-dev" });
    break;
  } catch (error) {
    if (attempt === 30 || !String(error).includes("NOT_FOUND")) throw error;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}
if (described?.namespaceInfo?.name !== "aiops-dev") throw new Error("namespace describe mismatch");
console.log("OK: dev worker mTLS connect + describeNamespace(aiops-dev)");

// 2) client 側 guard: staging cert × dev profile は接続前に E-TMP01
let guardCalls = 0;
try {
  await createTemporalConnection(profile, creds("staging"), async () => {
    guardCalls += 1;
    return connection;
  });
  throw new Error("guard did not reject staging credentials");
} catch (error) {
  if (!String(error).includes("E-TMP01") || guardCalls !== 0) throw error;
}
console.log("OK: staging cert rejected by client guard before connect (E-TMP01)");

// 3) server 側 per-env CA: guard を意図的に迂回して staging cert を直接使うと
//    TLS handshake で拒否される（環境スコープの server 強制の実証）
const staging = creds("staging");
try {
  await Connection.connect({
    address,
    connectTimeout: 5000,
    tls: {
      serverRootCACertificate: Buffer.from(creds("dev").serverRootCaPem),
      clientCertPair: {
        crt: Buffer.from(staging.clientCertPem),
        key: Buffer.from(staging.clientKeyPem),
      },
      serverNameOverride: "aiops-temporal-frontend.dev",
    },
  });
  throw new Error("server accepted a staging-issued certificate");
} catch (error) {
  if (String(error).includes("server accepted")) throw error;
}
console.log("OK: staging-issued cert rejected by server TLS (per-env CA)");

// 4) クライアント証明書なしは拒否（TEMPORAL_TLS_REQUIRE_CLIENT_AUTH=true）
try {
  await Connection.connect({
    address,
    connectTimeout: 5000,
    tls: {
      serverRootCACertificate: Buffer.from(creds("dev").serverRootCaPem),
      serverNameOverride: "aiops-temporal-frontend.dev",
    },
  });
  throw new Error("server accepted a connection without a client certificate");
} catch (error) {
  if (String(error).includes("server accepted")) throw error;
}
console.log("OK: no-client-cert connection rejected (require_client_auth)");

await connection.close();
