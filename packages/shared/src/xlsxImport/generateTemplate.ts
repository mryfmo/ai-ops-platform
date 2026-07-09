import { writeFileSync } from "node:fs";
import { buildXlsxImportTemplateBuffer } from "./template.js";

const output = process.argv[2] ?? "aiops-import-template.xlsx";
writeFileSync(output, await buildXlsxImportTemplateBuffer());
console.log(`wrote ${output}`);
