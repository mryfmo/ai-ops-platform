// 根拠: WBS P4-T01（P4-T01-001 是正）/ gate MCP-001
// smoke 専用の synthetic MCP server（streamable HTTP、stdlib のみ）。
// tools/list で 1 tool（synthetic_echo）を公開する。gateway 側の deny-all
// sentinel がこの tool を tools/list から filter し tools/call を deny する
// ことを、smoke-mcp-probe.mjs が gateway 経由で実測する。
import http from "node:http";

const PORT = Number(process.env.SMOKE_MCP_TARGET_PORT ?? 8931);

const TOOL = {
  name: "synthetic_echo",
  description: "smoke-only echo tool (must never be reachable through the gateway)",
  inputSchema: { type: "object", properties: { text: { type: "string" } } },
};

function rpcResult(id, result) {
  return JSON.stringify({ jsonrpc: "2.0", id, result });
}

const server = http.createServer((req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405).end();
    return;
  }
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (message.method === "initialize") {
      res.writeHead(200, { "content-type": "application/json" }).end(
        rpcResult(message.id, {
          protocolVersion: message.params?.protocolVersion ?? "2025-03-26",
          capabilities: { tools: {} },
          serverInfo: { name: "smoke-synthetic-target", version: "0.0.0" },
        }),
      );
      return;
    }
    if (message.method === "notifications/initialized") {
      res.writeHead(202).end();
      return;
    }
    if (message.method === "tools/list") {
      res.writeHead(200, { "content-type": "application/json" }).end(rpcResult(message.id, { tools: [TOOL] }));
      return;
    }
    if (message.method === "tools/call") {
      res
        .writeHead(200, { "content-type": "application/json" })
        .end(rpcResult(message.id, { content: [{ type: "text", text: "echo" }] }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" }).end(
      JSON.stringify({
        jsonrpc: "2.0",
        id: message.id ?? null,
        error: { code: -32601, message: "method not found" },
      }),
    );
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`smoke-mcp-target listening on :${PORT}`);
});
