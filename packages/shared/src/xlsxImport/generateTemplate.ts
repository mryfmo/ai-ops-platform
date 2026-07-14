/**
 * packages/shared/src/xlsxImport/generateTemplate.ts
 *
 * 根拠: REQ-037 / PrjOps:SPEC-INT-063 / AC-037-1 / ADR-0008。
 * Excelインポート用テンプレートをCLIから生成する。import時には副作用を発生させない。
 */
import { writeFileSync } from "node:fs";
import { buildXlsxImportTemplateBuffer } from "./template.js";

async function main(): Promise<void> {
  const output = process.argv[2] ?? "aiops-import-template.xlsx";
  writeFileSync(output, await buildXlsxImportTemplateBuffer());
  console.log(`wrote ${output}`);
}

if (/generateTemplate\.(ts|js)$/.test(process.argv[1]?.replace(/\\/g, "/") ?? "")) {
  await main();
}
