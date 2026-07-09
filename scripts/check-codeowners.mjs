import fs from "node:fs";

const file = process.env.CODEOWNERS_FILE ?? ".github/CODEOWNERS";
// Update only after verifying the account/team with gh; this repo currently has one verified owner.
const verifiedOwners = new Set(["@mryfmo"]);
const placeholderOwner = /^@(?:OWNER|TODO|TBD|FIXME|REPLACE_ME|YOUR[-_/A-Z0-9]*)$/i;
const emailOwner = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (!fs.existsSync(file)) {
  process.exit(0);
}

const ownerTokens = fs
  .readFileSync(file, "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"))
  .flatMap((line) => line.split(/\s+/).slice(1));

const placeholders = [...new Set(ownerTokens.filter((token) => placeholderOwner.test(token)))];
if (placeholders.length) {
  console.error(`::error file=${file}::Unresolved CODEOWNERS placeholder(s): ${placeholders.join(", ")}`);
  process.exit(1);
}

const unverified = [
  ...new Set(
    ownerTokens.filter((token) => (token.startsWith("@") || emailOwner.test(token)) && !verifiedOwners.has(token)),
  ),
];
if (unverified.length) {
  console.error(
    `::error file=${file}::Unverified CODEOWNERS owner(s): ${unverified.join(", ")}. Verify with gh before use.`,
  );
  process.exit(1);
}
