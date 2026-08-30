/**
 * 根拠: ADR-0032 / ADR-0006
 *
 * Installation token の権限は request ではなく GitHub App 側で最小化する。
 * 必要権限と key 保管手順は runbooks/ai-pr-identity.md を正本とする。
 */
import { createSign } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AUTH_ERROR = "GitHub installation token acquisition failed";
const REQUIRED_ENV = ["AIOPS_GH_APP_ID", "AIOPS_GH_APP_PRIVATE_KEY_PATH", "AIOPS_GH_APP_INSTALLATION_ID"];

class ConfigError extends Error {}

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function createAppJwt({ appId, privateKey }, nowMs = Date.now()) {
  const nowSeconds = Math.floor(nowMs / 1_000);
  const unsigned = `${base64url({ alg: "RS256", typ: "JWT" })}.${base64url({
    iss: appId,
    iat: nowSeconds - 60,
    exp: nowSeconds + 540,
  })}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(privateKey, "base64url")}`;
}

export function readConfig(env = process.env) {
  for (const name of REQUIRED_ENV) {
    const value = env[name];
    if (typeof value !== "string" || !value.trim())
      throw new ConfigError(`missing required environment variable: ${name}`);
  }
  return {
    appId: env.AIOPS_GH_APP_ID,
    privateKeyPath: env.AIOPS_GH_APP_PRIVATE_KEY_PATH,
    installationId: env.AIOPS_GH_APP_INSTALLATION_ID,
  };
}

export async function mintInstallationToken(config, fetchImpl = fetch, nowProvider = () => Date.now()) {
  const privateKey = fs.readFileSync(config.privateKeyPath, "utf8");
  const jwt = createAppJwt({ appId: config.appId, privateKey }, nowProvider());
  const response = await fetchImpl(
    `https://api.github.com/app/installations/${encodeURIComponent(config.installationId)}/access_tokens`,
    {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${jwt}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (response.status !== 201) throw new Error(AUTH_ERROR);
  const body = await response.json();
  const token = typeof body.token === "string" ? body.token : "";
  const expiresAt = typeof body.expires_at === "string" ? Date.parse(body.expires_at) : Number.NaN;
  if (!token.trim() || token !== token.trim() || !Number.isFinite(expiresAt) || expiresAt <= nowProvider()) {
    throw new Error(AUTH_ERROR);
  }
  return token;
}

export async function run({
  env = process.env,
  fetchImpl = fetch,
  nowProvider = () => Date.now(),
  stdout = (value) => process.stdout.write(value),
  stderr = (value) => process.stderr.write(value),
} = {}) {
  try {
    stdout(`${await mintInstallationToken(readConfig(env), fetchImpl, nowProvider)}\n`);
    return 0;
  } catch (error) {
    stderr(`mint-aiops-pr-token: ${error instanceof ConfigError ? error.message : AUTH_ERROR}\n`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await run();
}
