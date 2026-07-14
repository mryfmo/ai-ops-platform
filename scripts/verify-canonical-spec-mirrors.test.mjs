// 根拠: SPEC-INT-010 — 未信頼ZIPと正本ミラーのガバナンス境界を否定試験する。
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { deflateRawSync } from "node:zlib";

import {
  limits,
  readArchive,
  readArchiveBuffer,
  readMirror,
  validateName,
  verifySources,
} from "./verify-canonical-spec-mirrors.mjs";

function bytes(value) {
  return Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
}

function buildZip(entries) {
  const localChunks = [];
  const centralChunks = [];
  let localOffset = 0;

  for (const entry of entries) {
    const localName = bytes(entry.localName ?? entry.name);
    const centralName = bytes(entry.centralName ?? entry.name);
    const content = bytes(entry.content ?? "content");
    const method = entry.method ?? 8;
    const compressed = entry.compressed ?? (method === 0 ? content : deflateRawSync(content));
    const declaredSize = entry.declaredSize ?? content.length;
    const flags = entry.flags ?? 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(declaredSize, 22);
    local.writeUInt16LE(localName.length, 26);
    localChunks.push(local, localName, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(declaredSize, 24);
    central.writeUInt16LE(centralName.length, 28);
    central.writeUInt32LE((((entry.mode ?? 0o100644) & 0xffff) << 16) >>> 0, 38);
    central.writeUInt32LE(entry.localOffset ?? localOffset, 42);
    centralChunks.push(central, centralName);
    localOffset += local.length + localName.length + compressed.length;
  }

  const central = Buffer.concat(centralChunks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localChunks, central, eocd]);
}

test("SPEC-INT-010 accepts an allowlisted regular Markdown entry", () => {
  const result = readArchiveBuffer(buildZip([{ name: "a.md", content: "ok" }]), "test.zip", ["a.md"]);
  assert.equal(result.get("a.md").toString(), "ok");
});

test("SPEC-INT-010 rejects invalid UTF-8 filenames", () => {
  assert.throws(
    () => readArchiveBuffer(buildZip([{ name: Buffer.from([0xff, 0x2e, 0x6d, 0x64]) }]), "test.zip", ["a.md"]),
    /valid UTF-8/,
  );
});

test("SPEC-INT-010 rejects absolute, traversal, slash, backslash, and control filenames", () => {
  for (const name of ["/a.md", "..", "../a.md", "dir/a.md", "dir\\a.md", "a\u0001.md"]) {
    assert.throws(() => validateName(name), /unsafe or unsupported/);
  }
});

test("SPEC-INT-010 rejects renamed and non-allowlisted Unicode lookalike entries", () => {
  assert.throws(() => readArchiveBuffer(buildZip([{ name: "renamed.md" }]), "test.zip", ["a.md"]), /unexpected/);
  assert.throws(
    () => readArchiveBuffer(buildZip([{ name: "Σ.md" }, { name: "ς.md" }]), "test.zip", ["a.md", "b.md"]),
    /unexpected/,
  );
  assert.throws(
    () => readArchiveBuffer(buildZip([{ name: "ẞ.md" }, { name: "ss.md" }]), "test.zip", ["a.md", "b.md"]),
    /unexpected/,
  );
});

test("SPEC-INT-010 rejects NFC-equivalent duplicate entries", () => {
  assert.throws(
    () => readArchiveBuffer(buildZip([{ name: "e\u0301.md" }, { name: "é.md" }]), "test.zip", ["é.md", "other.md"]),
    /duplicate NFC/,
  );
});

test("SPEC-INT-010 rejects symlink, directory, and FIFO archive entries", () => {
  assert.throws(
    () => readArchiveBuffer(buildZip([{ name: "a.md", mode: 0o120777 }]), "test.zip", ["a.md"]),
    /regular files/,
  );
  assert.throws(() => readArchiveBuffer(buildZip([{ name: "dir/" }]), "test.zip", ["dir.md"]), /unsafe/);
  assert.throws(
    () => readArchiveBuffer(buildZip([{ name: "a.md", mode: 0o010644 }]), "test.zip", ["a.md"]),
    /regular files/,
  );
});

test("SPEC-INT-010 rejects central/local filename mismatches", () => {
  assert.throws(
    () => readArchiveBuffer(buildZip([{ name: "a.md", centralName: "b.md" }]), "test.zip", ["b.md"]),
    /central\/local header mismatch/,
  );
});

test("SPEC-INT-010 rejects truncated ZIP records", () => {
  const zip = buildZip([{ name: "a.md" }]);
  assert.throws(() => readArchiveBuffer(zip.subarray(0, zip.length - 1), "test.zip", ["a.md"]), /not found/);
});

test("SPEC-INT-010 rejects duplicate local-header offsets", () => {
  assert.throws(
    () =>
      readArchiveBuffer(buildZip([{ name: "a.md" }, { name: "b.md", localOffset: 0 }]), "test.zip", ["a.md", "b.md"]),
    /duplicate local-header offset/,
  );
});

test("SPEC-INT-010 rejects archives and declared entries above the limits before expansion", () => {
  assert.throws(() => readArchiveBuffer(Buffer.alloc(limits.archive + 1), "test.zip", ["a.md"]), /archive exceeds/);
  assert.throws(
    () =>
      readArchiveBuffer(
        buildZip([{ name: "a.md", content: "x", declaredSize: limits.uncompressedEntry + 1 }]),
        "test.zip",
        ["a.md"],
      ),
    /expanded entry is too large/,
  );
});

test("SPEC-INT-010 bounds expansion when the ZIP declares a false small size", () => {
  const compressedBomb = deflateRawSync(Buffer.alloc(2 * 1024 * 1024, 0x61));
  assert.throws(
    () =>
      readArchiveBuffer(
        buildZip([{ name: "a.md", content: "x", compressed: compressedBomb, declaredSize: 1 }]),
        "test.zip",
        ["a.md"],
      ),
    /Cannot create a Buffer larger than|larger than maxOutputLength|size mismatch/,
  );
});

test("SPEC-INT-010 rejects missing, extra, and oversized mirror entries", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spec-mirror-test-"));
  try {
    fs.writeFileSync(path.join(root, "a.md"), "a");
    assert.throws(() => readMirror(root, ["a.md", "b.md"]), /expected 2 entries/);
    fs.writeFileSync(path.join(root, "b.md"), "b");
    assert.throws(() => readMirror(root, ["a.md"]), /expected 1 entries/);
    fs.rmSync(path.join(root, "b.md"));
    fs.truncateSync(path.join(root, "a.md"), limits.uncompressedEntry + 1);
    assert.throws(() => readMirror(root, ["a.md"]), /too large/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("SPEC-INT-010 rejects mirror hash mismatches", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spec-source-test-"));
  const archive = path.join(root, "source.zip");
  const mirror = path.join(root, "mirror");
  try {
    fs.mkdirSync(mirror);
    fs.writeFileSync(archive, buildZip([{ name: "a.md", content: "archive" }]));
    fs.writeFileSync(path.join(mirror, "a.md"), "mirror");
    assert.throws(() => verifySources([{ archive, mirror, names: ["a.md"] }]), /content hash does not match/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("SPEC-INT-010 rejects a symlink used as the canonical ZIP path", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "spec-archive-test-"));
  const target = path.join(root, "target.zip");
  const link = path.join(root, "source.zip");
  try {
    fs.writeFileSync(target, buildZip([{ name: "a.md" }]));
    fs.symlinkSync(target, link);
    assert.throws(() => readArchive(link, ["a.md"]), /archive is not a regular file/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
