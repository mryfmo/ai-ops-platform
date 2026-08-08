/**
 * packages/shared/src/security/identityEnvelope.ts
 *
 * 根拠: DevOps:REQ-028 / DEC-SPEC-002 / AUD-OPM-001。
 * Auth.jsが検証したstable Entra subjectをWeb BFFからHonoへ渡す用途限定の署名契約。
 * canonical stringは v1|method|path|sha256(body)|tenant|object|issued_at_unix。
 *
 * Replay stance: listはread-only、decideはDBのpending CASが再実行を明示エラーにするため、
 * 90秒TTLとCASで十分としnonce storeは置かない。非冪等なrouteを追加する場合は再検討する。
 * 30秒のfuture skewは兄弟process間の時計差を吸収する一方、90秒のpast TTLは延長しない。
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const IDENTITY_ENVELOPE_TTL_SECONDS = 90;
export const IDENTITY_ENVELOPE_FUTURE_SKEW_SECONDS = 30;

export interface IdentityEnvelopeInput {
  method: string;
  path: string;
  body: string | Uint8Array;
  tenantId: string;
  objectId: string;
  issuedAtUnix: number;
}

const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const METHOD = /^[A-Z]+$/;
const SIGNATURE = /^sha256=([0-9a-f]{64})$/;

function canonicalString(input: IdentityEnvelopeInput): string {
  if (!METHOD.test(input.method) || !input.path.startsWith("/") || input.path.includes("|")) {
    throw new Error("E-IDENV01: invalid identity envelope canonical request");
  }
  if (!CANONICAL_UUID.test(input.tenantId) || !CANONICAL_UUID.test(input.objectId)) {
    throw new Error("E-IDENV01: invalid identity envelope subject");
  }
  if (!Number.isSafeInteger(input.issuedAtUnix) || input.issuedAtUnix < 0) {
    throw new Error("E-IDENV01: invalid identity envelope issued_at_unix");
  }
  const bodyHash = createHash("sha256").update(input.body).digest("hex");
  return `v1|${input.method}|${input.path}|${bodyHash}|${input.tenantId}|${input.objectId}|${input.issuedAtUnix}`;
}

function requireSecret(secret: string): void {
  if (secret.length < 32) throw new Error("E-IDENV01: identity envelope secret must be at least 32 characters");
}

export function signIdentityEnvelope(input: IdentityEnvelopeInput, secret: string): string {
  requireSecret(secret);
  return `sha256=${createHmac("sha256", secret).update(canonicalString(input)).digest("hex")}`;
}

export function verifyIdentityEnvelope(
  input: IdentityEnvelopeInput,
  signature: string | null | undefined,
  secret: string,
  nowUnix: number = Math.floor(Date.now() / 1000),
): boolean {
  try {
    requireSecret(secret);
    if (!Number.isSafeInteger(nowUnix)) return false;
    const age = nowUnix - input.issuedAtUnix;
    if (age > IDENTITY_ENVELOPE_TTL_SECONDS || age < -IDENTITY_ENVELOPE_FUTURE_SKEW_SECONDS) return false;
    const match = signature?.match(SIGNATURE);
    if (!match) return false;
    const actual = Buffer.from(match[1]!, "hex");
    const expected = createHmac("sha256", secret).update(canonicalString(input)).digest();
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
