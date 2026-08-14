// 根拠: FinalArch:FR-CP-008 / TMP-003 / ADR-0021 / DELTA-01
import dgram from "node:dgram";
import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import net from "node:net";

const deny = () => {
  throw new Error("Temporal shadow runner network access denied");
};

net.Socket.prototype.connect = deny;
net.connect = deny;
net.createConnection = deny;
dgram.Socket.prototype.connect = deny;
dgram.Socket.prototype.send = deny;
for (const api of ["lookup", "resolve", "resolve4", "resolve6", "reverse"]) {
  dns[api] = deny;
  dnsPromises[api] = deny;
}
globalThis.fetch = deny;
globalThis.WebSocket = deny;
