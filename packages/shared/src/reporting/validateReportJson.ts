import { readFileSync } from "node:fs";
import { assertValidStandardReportPayload } from "./reportValidation.js";

const input = process.argv[2] ? readFileSync(process.argv[2], "utf8") : readFileSync(0, "utf8");
assertValidStandardReportPayload(JSON.parse(input));
console.log("OK: standard report JSON is valid");
