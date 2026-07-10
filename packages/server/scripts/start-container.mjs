// packages/server/scripts/start-container.mjs
//
// 根拠: ADR-0005（単一コンテナ内でHono公開サーバとNext.js standaloneを兄弟プロセスとして並走）。
//   どちらかが異常終了したらコンテナ全体を終了し、オーケストレータの再起動ポリシーに委ねる。
//   SIGTERMは両プロセスへ転送してgraceful shutdownさせる。
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const children = [];

function launch(name, command, args, env = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  child.on("exit", (code, signal) => {
    console.error(`[supervisor] ${name} exited (code=${code}, signal=${signal}); stopping container`);
    for (const c of children) {
      if (c !== child && c.exitCode === null) c.kill("SIGTERM");
    }
    process.exit(code ?? 1);
  });
  children.push(child);
  console.log(`[supervisor] started ${name} (pid=${child.pid})`);
  return child;
}

// Hono常駐サーバ（:8080公開）
launch("server", "node", ["packages/server/dist/main.js"]);

// Next.js standalone（:3100内部）。ビルド成果物が存在する場合のみ起動（縮退運転可）
const nextServer = "packages/web/.next/standalone/packages/web/server.js";
if (existsSync(nextServer)) {
  launch("webui", "node", [nextServer], {
    PORT: process.env.WEBUI_INTERNAL_PORT ?? "3100",
    HOSTNAME: "127.0.0.1",
  });
} else {
  console.warn("[supervisor] WebUI standalone build not found; running without /app/* (503)");
}

for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    console.log(`[supervisor] ${sig} received; forwarding to children`);
    for (const c of children) {
      if (c.exitCode === null) c.kill("SIGTERM");
    }
  });
}
