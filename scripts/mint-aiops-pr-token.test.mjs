// 根拠: ADR-0032 / ADR-0006
import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { mintInstallationToken, run } from "./mint-aiops-pr-token.mjs";

const nowMs = Date.parse("2026-08-30T00:00:00.000Z");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aiops-pr-token-"));
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const privateKeyPath = path.join(tempDir, "app.pem");
fs.writeFileSync(privateKeyPath, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });

const config = {
  appId: "12345",
  privateKeyPath,
  installationId: "67890",
};
const env = {
  AIOPS_GH_APP_ID: config.appId,
  AIOPS_GH_APP_PRIVATE_KEY_PATH: privateKeyPath,
  AIOPS_GH_APP_INSTALLATION_ID: config.installationId,
};

after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

function decodeJwtPart(jwt, index) {
  return JSON.parse(Buffer.from(jwt.split(".")[index], "base64url").toString("utf8"));
}

describe("mint AI PR GitHub App token (ADR-0032)", () => {
  it("signs the required RS256 JWT and requests the installation token without network-coupled code", async () => {
    const fetchImpl = async (input, init) => {
      const authorization = init.headers.Authorization;
      const jwt = authorization.slice("Bearer ".length);
      const parts = jwt.split(".");

      assert.equal(input, "https://api.github.com/app/installations/67890/access_tokens");
      assert.equal(init.method, "POST");
      assert.deepEqual(init.headers, {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${jwt}`,
        "X-GitHub-Api-Version": "2022-11-28",
      });
      assert.deepEqual(decodeJwtPart(jwt, 0), { alg: "RS256", typ: "JWT" });
      assert.deepEqual(decodeJwtPart(jwt, 1), {
        iss: "12345",
        iat: nowMs / 1000 - 60,
        exp: nowMs / 1000 + 540,
      });
      assert.equal(
        verify("RSA-SHA256", parts.slice(0, 2).join("."), publicKey, Buffer.from(parts[2], "base64url")),
        true,
      );
      return Response.json({ token: "installation-token", expires_at: "2026-08-30T01:00:00.000Z" }, { status: 201 });
    };

    assert.equal(await mintInstallationToken(config, fetchImpl, () => nowMs), "installation-token");
  });

  it("writes only the token to stdout on success", async () => {
    let stdout = "";
    let stderr = "";
    const status = await run({
      env,
      fetchImpl: async () =>
        Response.json({ token: "installation-token", expires_at: "2026-08-30T01:00:00.000Z" }, { status: 201 }),
      nowProvider: () => nowMs,
      stdout: (value) => (stdout += value),
      stderr: (value) => (stderr += value),
    });

    assert.equal(status, 0);
    assert.equal(stdout, "installation-token\n");
    assert.equal(stderr, "");
  });

  for (const missing of Object.keys(env)) {
    it(`fails closed before fetch when ${missing} is missing`, async () => {
      let fetched = false;
      let stdout = "";
      let stderr = "";
      const incompleteEnv = { ...env };
      delete incompleteEnv[missing];
      const status = await run({
        env: incompleteEnv,
        fetchImpl: async () => {
          fetched = true;
          return new Response();
        },
        stdout: (value) => (stdout += value),
        stderr: (value) => (stderr += value),
      });

      assert.equal(status, 1);
      assert.equal(fetched, false);
      assert.equal(stdout, "");
      assert.match(stderr, new RegExp(missing, "u"));
    });
  }

  it("fails on an HTTP error without leaking the provider body", async () => {
    let stdout = "";
    let stderr = "";
    const status = await run({
      env,
      fetchImpl: async () => new Response("secret-response-token", { status: 403 }),
      nowProvider: () => nowMs,
      stdout: (value) => (stdout += value),
      stderr: (value) => (stderr += value),
    });

    assert.equal(status, 1);
    assert.equal(stdout, "");
    assert.match(stderr, /installation token acquisition failed/u);
    assert.doesNotMatch(stderr, /secret-response-token/u);
  });

  for (const [name, response] of [
    ["malformed JSON", new Response("not-json", { status: 201 })],
    ["blank token", Response.json({ token: " ", expires_at: "2026-08-30T01:00:00.000Z" }, { status: 201 })],
    [
      "expired token",
      Response.json({ token: "secret-token", expires_at: "2026-08-29T23:59:59.000Z" }, { status: 201 }),
    ],
  ]) {
    it(`rejects ${name} without printing token material`, async () => {
      let stdout = "";
      let stderr = "";
      const status = await run({
        env,
        fetchImpl: async () => response,
        nowProvider: () => nowMs,
        stdout: (value) => (stdout += value),
        stderr: (value) => (stderr += value),
      });

      assert.equal(status, 1);
      assert.equal(stdout, "");
      assert.doesNotMatch(stderr, /secret-token/u);
    });
  }
});
