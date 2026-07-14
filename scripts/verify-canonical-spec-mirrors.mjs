// 根拠: SPEC-INT-010 — 正本仕様と検索用ミラーの同一性をCIで強制する。
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TextDecoder } from "node:util";
import { inflateRawSync } from "node:zlib";

export const limits = Object.freeze({
  archive: 4 * 1024 * 1024,
  compressedEntry: 1024 * 1024,
  uncompressedEntry: 4 * 1024 * 1024,
  uncompressedTotal: 16 * 1024 * 1024,
});

export const sources = [
  {
    archive: "docs/PrjOps.zip",
    mirror: "docs/spec/prjops",
    names: [
      "00_README_文書体系と共通定義.md",
      "01_現状分析_AS-IS.md",
      "02_将来プロセス設計_TO-BE.md",
      "03_PRD.md",
      "04_外部仕様書.md",
      "05_内部仕様書.md",
      "06_開発環境表.md",
      "07_運用環境表.md",
    ],
  },
  {
    archive: "docs/DevOps.zip",
    mirror: "docs/spec/devops",
    names: [
      "01_現状分析と再設計.md",
      "02_PRD.md",
      "03_外部仕様書.md",
      "04_内部仕様書.md",
      "05_開発環境表.md",
      "06_運用環境表.md",
    ],
  },
];

const utf8 = new TextDecoder("utf-8", { fatal: true });
const controlCharacters = /[\u0000-\u001f\u007f-\u009f]/u;

function fail(message) {
  throw new Error(message);
}

function decodeName(bytes, source) {
  try {
    return utf8.decode(bytes);
  } catch {
    fail(`${source}: filename is not valid UTF-8`);
  }
}

export function validateName(rawName, source = "entry") {
  const name = rawName.normalize("NFC");
  if (
    !name ||
    controlCharacters.test(name) ||
    name.includes("/") ||
    name.includes("\\") ||
    name === "." ||
    name === ".." ||
    path.posix.isAbsolute(name) ||
    !name.endsWith(".md")
  ) {
    fail(`${source}: unsafe or unsupported entry ${JSON.stringify(rawName)}`);
  }
  return name;
}

function expectedSet(expectedNames, source) {
  const result = new Set();
  for (const rawName of expectedNames) {
    const name = validateName(rawName, source);
    if (result.has(name)) fail(`${source}: duplicate expected filename ${JSON.stringify(name)}`);
    result.add(name);
  }
  return result;
}

function addUnique(map, lowerNames, name, value, source) {
  const lowerName = name.toLowerCase();
  if (map.has(name)) fail(`${source}: duplicate NFC filename ${JSON.stringify(name)}`);
  if (lowerNames.has(lowerName)) fail(`${source}: case-insensitive filename collision ${JSON.stringify(name)}`);
  map.set(name, value);
  lowerNames.add(lowerName);
}

function findEocd(zip, source) {
  const minimum = Math.max(0, zip.length - 65_557);
  for (let offset = zip.length - 22; offset >= minimum; offset -= 1) {
    if (zip.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  fail(`${source}: ZIP end-of-central-directory record not found`);
}

export function readArchiveBuffer(zip, source, expectedNames) {
  if (zip.length > limits.archive) fail(`${source}: archive exceeds ${limits.archive} bytes`);
  const expected = expectedSet(expectedNames, source);
  const eocd = findEocd(zip, source);
  const disk = zip.readUInt16LE(eocd + 4);
  const centralDisk = zip.readUInt16LE(eocd + 6);
  const diskEntries = zip.readUInt16LE(eocd + 8);
  const entryCount = zip.readUInt16LE(eocd + 10);
  const centralSize = zip.readUInt32LE(eocd + 12);
  const centralOffset = zip.readUInt32LE(eocd + 16);
  const commentLength = zip.readUInt16LE(eocd + 20);

  if (disk !== 0 || centralDisk !== 0 || diskEntries !== entryCount) fail(`${source}: multi-disk ZIP is forbidden`);
  if (eocd + 22 + commentLength !== zip.length) fail(`${source}: trailing bytes or invalid ZIP comment length`);
  if (entryCount !== expected.size) fail(`${source}: expected ${expected.size} entries, found ${entryCount}`);
  if (centralOffset + centralSize !== eocd) fail(`${source}: invalid central-directory bounds`);

  const entries = new Map();
  const lowerNames = new Set();
  const localOffsets = new Set();
  let declaredTotal = 0;
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > eocd || zip.readUInt32LE(offset) !== 0x02014b50) {
      fail(`${source}: invalid central-directory entry ${index + 1}`);
    }
    const flags = zip.readUInt16LE(offset + 8);
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const uncompressedSize = zip.readUInt32LE(offset + 24);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const entryCommentLength = zip.readUInt16LE(offset + 32);
    const startDisk = zip.readUInt16LE(offset + 34);
    const externalAttributes = zip.readUInt32LE(offset + 38);
    const localOffset = zip.readUInt32LE(offset + 42);
    const end = offset + 46 + nameLength + extraLength + entryCommentLength;
    if (end > eocd) fail(`${source}: truncated central-directory entry ${index + 1}`);

    const rawName = zip.subarray(offset + 46, offset + 46 + nameLength);
    const displayName = decodeName(rawName, source);
    const name = validateName(displayName, source);
    const unixType = (externalAttributes >>> 16) & 0o170000;
    if (!expected.has(name)) fail(`${source}: unexpected filename ${JSON.stringify(name)}`);
    if (flags & 1) fail(`${source}: encrypted entry is forbidden: ${JSON.stringify(displayName)}`);
    if (method !== 0 && method !== 8) fail(`${source}: unsupported compression method ${method}`);
    if (startDisk !== 0) fail(`${source}: split entry is forbidden: ${JSON.stringify(displayName)}`);
    if ((unixType !== 0 && unixType !== 0o100000) || externalAttributes & 0x10) {
      fail(`${source}: only regular files are allowed: ${JSON.stringify(displayName)}`);
    }
    if (compressedSize > limits.compressedEntry) fail(`${source}: compressed entry is too large: ${name}`);
    if (uncompressedSize > limits.uncompressedEntry) fail(`${source}: expanded entry is too large: ${name}`);
    declaredTotal += uncompressedSize;
    if (declaredTotal > limits.uncompressedTotal) fail(`${source}: expanded archive is too large`);
    if (localOffsets.has(localOffset)) fail(`${source}: duplicate local-header offset ${localOffset}`);
    localOffsets.add(localOffset);
    if (localOffset + 30 > centralOffset || zip.readUInt32LE(localOffset) !== 0x04034b50) {
      fail(`${source}: invalid local header for ${JSON.stringify(displayName)}`);
    }
    const localFlags = zip.readUInt16LE(localOffset + 6);
    const localMethod = zip.readUInt16LE(localOffset + 8);
    const localNameLength = zip.readUInt16LE(localOffset + 26);
    const localExtraLength = zip.readUInt16LE(localOffset + 28);
    const localNameStart = localOffset + 30;
    const dataStart = localNameStart + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > centralOffset) fail(`${source}: invalid data bounds for ${JSON.stringify(displayName)}`);
    const localNameEnd = localNameStart + localNameLength;
    if (localNameEnd > centralOffset) fail(`${source}: truncated local filename for ${JSON.stringify(displayName)}`);
    const localName = validateName(decodeName(zip.subarray(localNameStart, localNameEnd), source), source);
    if (localName !== name || localFlags !== flags || localMethod !== method) {
      fail(`${source}: central/local header mismatch for ${JSON.stringify(displayName)}`);
    }
    const compressed = zip.subarray(dataStart, dataEnd);
    const content =
      method === 0
        ? Buffer.from(compressed)
        : inflateRawSync(compressed, { maxOutputLength: Math.max(1, uncompressedSize) });
    if (content.length !== uncompressedSize) fail(`${source}: size mismatch for ${JSON.stringify(displayName)}`);
    addUnique(entries, lowerNames, name, content, source);
    offset = end;
  }
  if (offset !== eocd) fail(`${source}: central-directory size mismatch`);
  for (const name of expected) {
    if (!entries.has(name)) fail(`${source}: missing expected filename ${JSON.stringify(name)}`);
  }
  return entries;
}

export function readArchive(file, expectedNames) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile()) fail(`${file}: archive is not a regular file`);
  if (stat.size > limits.archive) fail(`${file}: archive exceeds ${limits.archive} bytes`);
  return readArchiveBuffer(fs.readFileSync(file), file, expectedNames);
}

export function readMirror(directory, expectedNames) {
  const expected = expectedSet(expectedNames, directory);
  const dirents = fs.readdirSync(directory, { encoding: "buffer", withFileTypes: true });
  if (dirents.length !== expected.size)
    fail(`${directory}: expected ${expected.size} entries, found ${dirents.length}`);
  const entries = new Map();
  const lowerNames = new Set();
  let total = 0;
  for (const dirent of dirents) {
    const displayName = decodeName(dirent.name, directory);
    const name = validateName(displayName, directory);
    if (!expected.has(name)) fail(`${directory}: unexpected filename ${JSON.stringify(name)}`);
    if (!dirent.isFile() || dirent.isSymbolicLink()) {
      fail(`${directory}: only regular Markdown files are allowed: ${JSON.stringify(displayName)}`);
    }
    const file = path.join(directory, displayName);
    const stat = fs.lstatSync(file);
    if (!stat.isFile()) fail(`${file}: only regular files are allowed`);
    if (stat.size > limits.uncompressedEntry) fail(`${file}: mirror entry is too large`);
    total += stat.size;
    if (total > limits.uncompressedTotal) fail(`${directory}: mirror is too large`);
    addUnique(entries, lowerNames, name, fs.readFileSync(file), directory);
  }
  for (const name of expected) {
    if (!entries.has(name)) fail(`${directory}: missing expected filename ${JSON.stringify(name)}`);
  }
  return entries;
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

export function verifySources(config = sources) {
  for (const source of config) {
    const archive = readArchive(source.archive, source.names);
    const mirror = readMirror(source.mirror, source.names);
    for (const [name, archivedContent] of archive) {
      const mirroredContent = mirror.get(name);
      if (!mirroredContent) fail(`${source.mirror}: missing ${JSON.stringify(name)}`);
      if (sha256(archivedContent) !== sha256(mirroredContent)) {
        fail(`${source.mirror}/${name}: content hash does not match ${source.archive}`);
      }
      mirror.delete(name);
    }
    if (mirror.size) fail(`${source.mirror}: unexpected entries: ${[...mirror.keys()].join(", ")}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifySources();
  console.log("OK: canonical ZIP archives match their allowlisted spec mirrors (PrjOps 8, DevOps 6).");
}
