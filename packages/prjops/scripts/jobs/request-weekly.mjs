#!/usr/bin/env node
/**
 * packages/prjops/scripts/jobs/request-weekly.mjs
 *
 * REQ-003（進捗報告依頼の自動送付）の本番実行スクリプト例。
 * `.github/workflows/request-weekly.yml`（水09:00 JST）から呼ばれる想定。
 *
 * 注意: これは実クレデンシャルでの実行方法を示す「参考実装」である。このリポジトリの
 * オフライン検証環境ではネットワークアクセスができないため実行確認はしていない
 * （verification/VERIFICATION_REPORT.md §1.2参照）。他のジョブ（remind-weekly.mjs,
 * analyze-weekly.mjs, report-weekly.mjs, verify-weekly.mjs, deliver-weekly.mjs,
 * track-daily.mjs, monthly-quarterly-check.mjs, escalate-to-pmo.mjs）も同一パターンで
 * 実装できる: (1)環境変数から認証情報を読む (2)shared/dist のクライアントを組み立てる
 * (3)prjops-dataリポジトリのYAMLを読む (4)対応するagents層の関数を呼ぶ (5)結果をログ出力する。
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { GraphClient } from "@aiops/shared/clients/graphClient.js";
import { InMemoryAuditLog } from "@aiops/shared/auditLog.js";
import { newTraceId, isoWeekOf } from "@aiops/shared/ids.js";
import { resolveLanguage } from "@aiops/shared/language.js";
import { sendProgressReportRequests } from "@aiops/prjops/agents/AGT05_distributor.js";

// --- 認証: Microsoft Entra ID アプリケーション権限（client credentials flow） ---
// 実運用では @azure/msal-node の ConfidentialClientApplication を使う。
async function createGraphTokenProvider() {
  const { GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, GRAPH_TENANT_ID } = process.env;
  if (!GRAPH_CLIENT_ID || !GRAPH_CLIENT_SECRET || !GRAPH_TENANT_ID) {
    throw new Error("E-CFG01: GRAPH_CLIENT_ID/GRAPH_CLIENT_SECRET/GRAPH_TENANT_ID が未設定です");
  }
  return {
    async getAccessToken() {
      // 参考実装: 実際には @azure/msal-node の acquireTokenByClientCredential を呼ぶ。
      // const msal = await import("@azure/msal-node");
      // const app = new msal.ConfidentialClientApplication({ auth: { clientId: GRAPH_CLIENT_ID, clientSecret: GRAPH_CLIENT_SECRET, authority: `https://login.microsoftonline.com/${GRAPH_TENANT_ID}` } });
      // const result = await app.acquireTokenByClientCredential({ scopes: ["https://graph.microsoft.com/.default"] });
      // return result.accessToken;
      throw new Error("E-CFG02: MSAL連携は本番環境でのみ実装・実行すること（このリポジトリでは擬似コードのみ提供）");
    },
  };
}

async function loadYamlDir(dir) {
  const files = await readdir(dir).catch(() => []);
  const records = [];
  for (const f of files.filter((f) => f.endsWith(".yaml"))) {
    const content = await readFile(join(dir, f), "utf8");
    records.push(parseYaml(content));
  }
  return records;
}

async function main() {
  const dataRoot = process.env.PRJOPS_DATA_PATH ?? "./prjops-data";
  const projects = (await loadYamlDir(join(dataRoot, "projects"))).filter((p) => p.status === "active");
  const stakeholders = await loadYamlDir(join(dataRoot, "stakeholders"));
  const organizations = await loadYamlDir(join(dataRoot, "organizations"));
  const statusUpdates = await loadYamlDir(join(dataRoot, "status_updates"));

  const tokenProvider = await createGraphTokenProvider();
  const graphClient = new GraphClient(tokenProvider);
  const auditLog = new InMemoryAuditLog();
  const traceId = newTraceId();
  const { isoYear, isoWeek } = isoWeekOf(new Date().toISOString().slice(0, 10));

  const targets = [];
  for (const project of projects) {
    const leader = stakeholders.find((s) => s.id === project.leader_id);
    if (!leader) continue;
    const org = organizations.find((o) => o.id === leader.organization_id);
    const lang = resolveLanguage({ preferredLanguage: leader.preferred_language, organizationCountry: org?.country });
    const previous = statusUpdates.filter((s) => s.project_id === project.id).sort((a, b) => (a.id < b.id ? 1 : -1))[0];

    targets.push({
      projectId: project.id,
      projectName: project.name,
      weekLabel: new Date().toISOString().slice(0, 10),
      recipientEmail: leader.email,
      lang,
      previousSummary3Lines: previous?.achievements ?? "(前回報告なし)",
    });
  }

  await sendProgressReportRequests(targets, {
    graphClient,
    auditLog,
    traceId,
    fromMailbox: process.env.PRJOPS_FROM_MAILBOX ?? "prjops-system@example.com",
  });

  console.log(`request-weekly: ${targets.length}件送信 (ISO week ${isoYear}-W${isoWeek}, trace_id=${traceId})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
