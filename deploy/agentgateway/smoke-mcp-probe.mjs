// 根拠: WBS P4-T01（P4-T01-001 是正）/ gate MCP-001
// 認証済み MCP session を gateway に張り、authorization（deny-all sentinel）を
// 認証の「先」で実測する probe:
// 1. synthetic target 直叩きの tools/list に synthetic_echo が存在（fixture 結線の実在証明）
// 2. gateway 経由の tools/list は空（denied tool は list から filter される）
// 3. gateway 経由の tools/call synthetic_echo は deny（unknown/denied tool call 失敗）
// 使い方: SMOKE_JWT=<token> node smoke-mcp-probe.mjs <gateway-addr:port> <target-addr:port>
import assert from "node:assert/strict";

const [gateway, target] = process.argv.slice(2);
const token = process.env.SMOKE_JWT;
assert(gateway && target && token, "usage: SMOKE_JWT=... node smoke-mcp-probe.mjs <gateway> <target>");

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

// 1. target 直: synthetic_echo が公開されている（filter の比較対象の実在証明）。
const direct = await initialize(target, {});
const directTools = await rpc(target, direct, "tools/list", {}, 2);
assert.deepEqual(
  directTools.message?.result?.tools?.map((tool) => tool.name),
  ["synthetic_echo"],
  "synthetic target must expose synthetic_echo directly",
);
console.log("OK: synthetic target exposes synthetic_echo when called directly");

// 2. gateway 経由: 認証は通るが tools/list は空（deny-all filter）。
const auth = { authorization: `Bearer ${token}` };
const viaGateway = await initialize(gateway, auth);
const gatewayTools = await rpc(gateway, viaGateway, "tools/list", {}, 2);
assert.equal(gatewayTools.status, 200, "authenticated tools/list must reach authorization (not 401)");
assert.deepEqual(
  gatewayTools.message?.result?.tools ?? [],
  [],
  "gateway tools/list must be empty: denied tools are filtered by the deny-all sentinel",
);
console.log("OK: authenticated tools/list via gateway is empty (denied tools filtered)");

// 3. gateway 経由: tools/call は deny される（result 成功以外を要求）。
const call = await rpc(gateway, viaGateway, "tools/call", { name: "synthetic_echo", arguments: { text: "x" } }, 3);
const denied = call.status !== 200 || call.message?.error !== undefined || call.message?.result?.isError === true;
assert(
  denied,
  `tools/call synthetic_echo must be denied, got status=${call.status} body=${JSON.stringify(call.message)}`,
);
assert.notEqual(call.message?.result?.content?.[0]?.text, "echo", "denied tool call must never reach the target");
console.log("OK: authenticated tools/call synthetic_echo denied by mcpAuthorization");
