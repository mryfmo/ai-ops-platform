// 根拠: FinalArch:TMP-001 / ENV-DEC-001 + Owner 裁定 2026-08-13（P3-T01）
// プラットフォーム内部発行の Temporal 認可トークン（RS256 JWT）を発行する。
// Entra / 外部 IdP は関与しない（Entra は M365 専用 — P0-T07a）。
// 使い方:
//   node mint-token.mjs <env> worker <worker-name>   # namespace write のみ・非 admin
//   node mint-token.mjs <env> operator <name>        # admin（運用者別 identity）
// 署名鍵は gen-authz.sh の出力（dev）/ Secrets Manager（staging/prod）から読む。
import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const [environment, role, name] = process.argv.slice(2);
const ENVIRONMENTS = ["dev", "staging", "prod"];
if (!ENVIRONMENTS.includes(environment) || !["worker", "operator"].includes(role) || !name) {
  console.error("usage: mint-token.mjs <dev|staging|prod> <worker|operator> <name>");
  process.exit(1);
}

const keyPath =
  process.env.TEMPORAL_AUTHZ_KEY ??
  join(dirname(fileURLToPath(import.meta.url)), "out", environment, "jwt-signing.key");
const privateKey = createPrivateKey(readFileSync(keyPath));

const namespace = `aiops-${environment}`;
// Temporal default claim mapper の permissions 語彙: "<namespace>:<read|write|worker|admin>"
// worker は自 namespace の write のみ（admin なし）。operator は admin。
const permissions = role === "worker" ? [`${namespace}:write`] : [`temporal-system:admin`, `${namespace}:admin`];

const now = Math.floor(Date.now() / 1000);
const ttlSeconds = Number(process.env.TOKEN_TTL_SECONDS ?? 12 * 60 * 60);
const header = { alg: "RS256", typ: "JWT", kid: `aiops-temporal-authz.${environment}` };
const payload = {
  sub: `aiops-temporal-${role}.${environment}.${name}`,
  iss: `aiops-temporal-authz.${environment}`,
  iat: now,
  exp: now + ttlSeconds,
  permissions,
};

const b64url = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const signingInput = `${b64url(header)}.${b64url(payload)}`;
const signature = sign("RSA-SHA256", Buffer.from(signingInput), privateKey).toString("base64url");
process.stdout.write(`${signingInput}.${signature}\n`);
