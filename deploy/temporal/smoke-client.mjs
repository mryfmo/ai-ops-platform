// 根拠: FinalArch:TMP-001 / ENV-DEC-001 + Owner 裁定 2026-08-13（P3-T01 verification client）
// smoke.sh から呼ばれる。@aiops/control-plane（ビルド済み dist）で
// mTLS（transport）+ 内部発行 JWT（server 側認可）の許可/拒否マトリクスを検証する。
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import {
  buildConnectionProfile,
  createScopedWorker,
  createTemporalConnection,
} from "../../packages/control-plane/dist/index.js";

// @temporalio/client は control-plane の依存として解決する（root には置かない）
const requireFromControlPlane = createRequire(new URL("../../packages/control-plane/package.json", import.meta.url));
const { Connection } = requireFromControlPlane("@temporalio/client");

const address = process.env.TEMPORAL_SMOKE_ADDRESS;
const certDir = process.env.TEMPORAL_SMOKE_CERT_DIR;
const authzDir = process.env.TEMPORAL_SMOKE_AUTHZ_DIR;
if (!address || !certDir || !authzDir) {
  throw new Error("TEMPORAL_SMOKE_ADDRESS / TEMPORAL_SMOKE_CERT_DIR / TEMPORAL_SMOKE_AUTHZ_DIR are required");
}

const mint = (env, role, name) => {
  const out = execFileSync("node", [join(authzDir, "mint-token.mjs"), env, role, name], {
    env: { ...process.env, TEMPORAL_AUTHZ_KEY: join(authzDir, "out", env, "jwt-signing.key") },
  });
  return out.toString().trim();
};

const creds = (env, token) => ({
  clientCertPem: readFileSync(join(certDir, env, "worker.crt"), "utf8"),
  clientKeyPem: readFileSync(join(certDir, env, "worker.key"), "utf8"),
  serverRootCaPem: readFileSync(join(certDir, env, "ca.crt"), "utf8"),
  authorizationTokenProvider: () => token,
});

const operatorTls = {
  serverRootCACertificate: Buffer.from(readFileSync(join(certDir, "dev", "ca.crt"), "utf8")),
  clientCertPair: {
    crt: Buffer.from(readFileSync(join(certDir, "dev", "operator.crt"), "utf8")),
    key: Buffer.from(readFileSync(join(certDir, "dev", "operator.key"), "utf8")),
  },
  serverNameOverride: "aiops-temporal-frontend.dev",
};

const workerToken = mint("dev", "worker", "w1");
const operatorToken = mint("dev", "operator", "ops1");
const foreignToken = mint("staging", "worker", "w1"); // staging 鍵で署名 = 署名不一致

// 0) operator（admin JWT + operator cert）で接続し、namespace を初期化する
//    （auto-setup の登録は authorizer 有効化に伴い SKIP。登録成功自体が admin 許可の実証）
let operator;
for (let attempt = 1; attempt <= 60; attempt += 1) {
  try {
    operator = await Connection.connect({ address, connectTimeout: 5000, apiKey: operatorToken, tls: operatorTls });
    break;
  } catch (error) {
    if (attempt === 60) throw error;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}
const retention = { seconds: 3 * 24 * 60 * 60 };
for (const ns of ["aiops-dev", "aiops-shadow"]) {
  try {
    await operator.workflowService.registerNamespace({ namespace: ns, workflowExecutionRetentionPeriod: retention });
  } catch (error) {
    if (!/already exists|AlreadyExists/u.test(String(error))) throw error;
  }
}
for (let attempt = 1; attempt <= 30; attempt += 1) {
  try {
    await operator.workflowService.describeNamespace({ namespace: "aiops-dev" });
    break;
  } catch (error) {
    if (attempt === 30 || !String(error).includes("NOT_FOUND")) throw error;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
console.log("OK: operator (admin JWT + mTLS) registered aiops-dev / aiops-shadow");

// 1) worker（namespace write JWT）: 自 namespace の describe は許可
const profile = buildConnectionProfile("dev", address, { workerName: "w1", taskQueue: "incident" });
const worker = await createTemporalConnection(profile, creds("dev", workerToken), (options) =>
  Connection.connect({ ...options, connectTimeout: 5000 }),
);
const described = await worker.workflowService.describeNamespace({ namespace: "aiops-dev" });
if (described.namespaceInfo?.name !== "aiops-dev") throw new Error("namespace describe mismatch");
console.log("OK: worker JWT allowed in own namespace (describe aiops-dev)");

const expectDenied = async (label, fn) => {
  try {
    await fn();
    throw new Error(`NOT DENIED: ${label}`);
  } catch (error) {
    let text = "";
    for (let cursor = error, depth = 0; cursor && depth < 5; cursor = cursor.cause, depth += 1) {
      text += ` ${String(cursor)}`;
    }
    if (text.includes("NOT DENIED")) throw error;
    if (!/PERMISSION_DENIED|PermissionDenied|UNAUTHENTICATED|Unauthenticated/u.test(text)) {
      throw new Error(`unexpected error class for ${label}: ${text.slice(0, 200)}`);
    }
  }
  console.log(`OK: denied — ${label}`);
};

// 2) worker JWT の越境 namespace は server が拒否
await expectDenied("worker JWT × other namespace (aiops-shadow)", () =>
  worker.workflowService.describeNamespace({ namespace: "aiops-shadow" }),
);
// 3) worker JWT の admin 操作は server が拒否
await expectDenied("worker JWT × admin API (registerNamespace)", () =>
  worker.workflowService.registerNamespace({ namespace: "aiops-x", workflowExecutionRetentionPeriod: retention }),
);
// 4) トークンなしは拒否（mTLS だけでは何もできない）
await expectDenied("no JWT (mTLS only)", async () => {
  const anonymous = await Connection.connect({ address, connectTimeout: 5000, tls: operatorTls });
  await anonymous.workflowService.describeNamespace({ namespace: "aiops-dev" });
});
// 5) 他環境鍵で署名されたトークンは拒否（署名検証）
await expectDenied("foreign-signed JWT (staging key)", async () => {
  const forged = await Connection.connect({ address, connectTimeout: 5000, apiKey: foreignToken, tls: operatorTls });
  await forged.workflowService.describeNamespace({ namespace: "aiops-dev" });
});

// 6) transport 層の拒否（per-env CA / require_client_auth）
const stagingCert = creds("staging", workerToken);
try {
  await Connection.connect({
    address,
    connectTimeout: 5000,
    apiKey: workerToken,
    tls: {
      serverRootCACertificate: operatorTls.serverRootCACertificate,
      clientCertPair: {
        crt: Buffer.from(stagingCert.clientCertPem),
        key: Buffer.from(stagingCert.clientKeyPem),
      },
      serverNameOverride: "aiops-temporal-frontend.dev",
    },
  });
  throw new Error("server accepted a staging-issued certificate");
} catch (error) {
  if (String(error).includes("server accepted")) throw error;
}
console.log("OK: staging-issued cert rejected by server TLS (per-env CA)");
try {
  await Connection.connect({
    address,
    connectTimeout: 5000,
    apiKey: workerToken,
    tls: {
      serverRootCACertificate: operatorTls.serverRootCACertificate,
      serverNameOverride: "aiops-temporal-frontend.dev",
    },
  });
  throw new Error("server accepted a connection without a client certificate");
} catch (error) {
  if (String(error).includes("server accepted")) throw error;
}
console.log("OK: no-client-cert connection rejected (require_client_auth)");

// 7) client 側 guard（接続前 fail-closed）
let guardCalls = 0;
try {
  await createTemporalConnection(profile, creds("staging", workerToken), async () => {
    guardCalls += 1;
    return worker;
  });
  throw new Error("guard did not reject staging credentials");
} catch (error) {
  if (!String(error).includes("E-TMP01") || guardCalls !== 0) throw error;
}
console.log("OK: staging cert rejected by client guard before connect (E-TMP01)");

// 8) token sub と profile 個体の不整合は接続前に拒否（P3-T01-006 の identity 束縛）
const w2token = mint("dev", "worker", "w2");
let subGuardCalls = 0;
try {
  await createTemporalConnection(profile, creds("dev", w2token), async () => {
    subGuardCalls += 1;
    return worker;
  });
  throw new Error("sub guard did not reject mismatched worker token");
} catch (error) {
  if (!String(error).includes("E-TMP01") || subGuardCalls !== 0) throw error;
}
console.log("OK: token sub mismatch rejected before connect (worker identity binding)");

// 9) scoped Worker が profile の単一 task queue を実際に polling する（実効 guard）
const scoped = await createScopedWorker(profile, creds("dev", workerToken), {
  activities: { smokeNoop: async () => "ok" },
});
if (scoped.worker.options.taskQueue !== "incident" || scoped.worker.options.namespace !== "aiops-dev") {
  throw new Error("scoped worker options drifted from profile");
}
const runPromise = scoped.worker.run();
await new Promise((resolve) => setTimeout(resolve, 4000));
if (scoped.worker.getState() !== "RUNNING") throw new Error(`worker state: ${scoped.worker.getState()}`);
scoped.worker.shutdown();
await runPromise;
await scoped.connection.close();
console.log("OK: scoped worker polled its single profile task queue (incident) under mTLS + JWT");

await worker.close();
await operator.close();
