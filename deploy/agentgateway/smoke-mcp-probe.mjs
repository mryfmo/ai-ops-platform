// 根拠: WBS P4-T01（P4-T01-001/006 是正）/ gate MCP-001
// 認証済み MCP session を gateway に張り、authorization（deny-all sentinel）を
// 認証の「先」で実測する probe:
// 1. synthetic target 直叩きの tools/list に nonce 付き synthetic_echo が存在
//    （SMOKE_NONCE は smoke.sh がこの run で採番 — decoy target では一致しない）
// 2. gateway 経由の tools/list は空（denied tool は list から filter される）
//    かつ target の tools/list counter が増加（gateway が「同じ process」から
//    取得した上で filter した証明。P4-T01-006 の decoy 反証対策）
// 3. gateway 経由の tools/call synthetic_echo は vendor の厳密な denial
//    （HTTP 400 / JSON-RPC -32602 "Unknown tool: ..."）で拒否され、
//    target の tools/call counter は 0 のまま（call が target に未到達）
// 使い方: SMOKE_JWT=<token> SMOKE_NONCE=<nonce> node smoke-mcp-probe.mjs <gateway> <target>
import assert from "node:assert/strict";

const [gateway, target] = process.argv.slice(2);
const token = process.env.SMOKE_JWT;
const nonce = process.env.SMOKE_NONCE;
assert(
  gateway && target && token && nonce,
  "usage: SMOKE_JWT=... SMOKE_NONCE=... node smoke-mcp-probe.mjs <gateway> <target>",
);

const PROTOCOL_VERSION = "2025-03-26";

function parseBody(text, contentType) {
  if (contentType.includes("text/event-stream")) {
    const data = text
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("");
    return JSON.parse(data);
  }
  return JSON.parse(text);
}

async function rpc(base, { headers = {}, session }, method, params, id) {
  const response = await fetch(`http://${base}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(session ? { "mcp-session-id": session } : {}),
      ...headers,
    },
    body: JSON.stringify({ jsonrpc: "2.0", ...(id === undefined ? {} : { id }), method, params }),
  });
  const text = await response.text();
  const sessionId = response.headers.get("mcp-session-id") ?? session;
  if (!text.trim()) {
    return { status: response.status, sessionId, message: null };
  }
  return { status: response.status, sessionId, message: parseBody(text, response.headers.get("content-type") ?? "") };
}

async function initialize(base, headers) {
  const init = await rpc(
    base,
    { headers },
    "initialize",
    {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "smoke-probe", version: "0.0.0" },
    },
    1,
  );
  assert.equal(init.status, 200, `initialize against ${base} must succeed (got ${init.status})`);
  await rpc(base, { headers, session: init.sessionId }, "notifications/initialized", {});
  return { headers, session: init.sessionId };
}

async function targetStats() {
  const response = await fetch(`http://${target}/smoke-stats`);
  assert.equal(response.status, 200, "target /smoke-stats must answer");
  const stats = await response.json();
  assert.equal(stats.nonce, nonce, "target /smoke-stats must carry this run's nonce");
  return stats.counters;
}

// 1. target 直: この run の nonce を刻んだ synthetic_echo が公開されている。
const direct = await initialize(target, {});
const directTools = await rpc(target, direct, "tools/list", {}, 2);
const directTool = directTools.message?.result?.tools?.[0];
assert.equal(directTool?.name, "synthetic_echo", "synthetic target must expose synthetic_echo directly");
assert.match(
  directTool?.description ?? "",
  new RegExp(`nonce=${nonce}\\b`, "u"),
  "direct tools/list must carry this run's nonce (same-process proof)",
);
console.log("OK: synthetic target exposes nonce-stamped synthetic_echo when called directly");

const before = await targetStats();

// 2. gateway 経由: 認証は通るが tools/list は空（deny-all filter）。
//    同時に target 側 counter の増加で「gateway が同じ process へ到達した」を検分。
const auth = { authorization: `Bearer ${token}` };
const viaGateway = await initialize(gateway, auth);
const gatewayTools = await rpc(gateway, viaGateway, "tools/list", {}, 2);
assert.equal(gatewayTools.status, 200, "authenticated tools/list must reach authorization (not 401)");
assert.deepEqual(
  gatewayTools.message?.result?.tools ?? [],
  [],
  "gateway tools/list must be empty: denied tools are filtered by the deny-all sentinel",
);
const afterList = await targetStats();
assert(
  afterList["tools/list"] > before["tools/list"],
  "the gateway must have fetched tools/list from THIS target process (decoy guard)",
);
console.log("OK: authenticated tools/list via gateway is empty while this target served the merge (counter advanced)");

// 3. gateway 経由: tools/call は vendor の厳密な denial 形で拒否され、
//    target には到達しない。
const call = await rpc(gateway, viaGateway, "tools/call", { name: "synthetic_echo", arguments: { text: "x" } }, 3);
assert.equal(call.status, 400, `denied tools/call must be HTTP 400 (got ${call.status})`);
assert.equal(call.message?.error?.code, -32602, "denied tools/call must be JSON-RPC -32602");
assert.equal(
  call.message?.error?.message,
  "Unknown tool: synthetic_echo",
  "denied tool must be reported as unknown (filtered out of the tool set)",
);
const afterCall = await targetStats();
assert.equal(afterCall["tools/call"], 0, "the denied call must never reach the target process");
console.log("OK: authenticated tools/call denied as unknown tool (400/-32602) without reaching the target");
