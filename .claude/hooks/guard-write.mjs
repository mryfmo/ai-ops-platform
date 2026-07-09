// PreToolUse(Edit|Write) ガード: 禁止パスへの書込ブロックと schema.sql 変更のリマインド
// 根拠: CLAUDE.md「Git/PR規約」「schema.sql変更手順」/ ADR-0006
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const rawPath = input?.tool_input?.file_path ?? "";
const p = String(rawPath).replace(/\\/g, "/");

// dist/・.env*・ロックファイルへの直接書込は禁止
if (/\/dist\//.test(p) || /(^|\/)\.env(\.[^/]*)?$/.test(p) || /pnpm-lock\.yaml$/.test(p)) {
  console.error(
    `書込禁止パス: ${p}\n` +
      "dist/ はビルド生成物、.env* は秘密情報、pnpm-lock.yaml は pnpm install で更新する（CLAUDE.md）。",
  );
  process.exit(2); // block
}

// schema.sql 変更時のリマインド（ブロックはしない）
if (/packages\/devops\/src\/db\/schema\.sql$/.test(p)) {
  console.log(
    "リマインド: schema.sql の変更は db-migration スキルの手順に従うこと " +
      "(Repo層+テストを同一PRで追加 / ロールバックDDLをコメント併記 / audit_logへのUPDATE・DELETE付与禁止)。",
  );
}
process.exit(0);
