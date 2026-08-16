// 根拠: FinalArch:PRD-008 / FinalArch:FR-AGT-001..006 / FinalArch:COD-001 / FinalArch:COD-004 / ADR-0027 / WBS P8-T02
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, renameSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const guard = fileURLToPath(new URL("./coding-agent-path-guard.mjs", import.meta.url));
const validManifest = fileURLToPath(new URL("../contracts/agent-task/fixtures/valid.manifest.json", import.meta.url));
const TEST_INTEGRITY_KEY = "synthetic-path-guard-integrity-key-for-tests-only";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout}${result.stderr}`);
  }
  return result.stdout;
}

function git(repo, ...args) {
  return run("git", ["-C", repo, ...args]);
}

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "aiops-path-guard-"));
  const repo = path.join(root, "repo");
  mkdirSync(repo);
  for (const directory of [
    "allowed",
    "forbidden",
    ".github/workflows",
    ".github/actions/example",
    "contracts/agent-task",
    "scripts",
  ]) {
    mkdirSync(path.join(repo, directory), { recursive: true });
  }
  writeFileSync(path.join(repo, "allowed/source.txt"), "before\n");
  writeFileSync(path.join(repo, "forbidden/blocked.txt"), "blocked\n");
  writeFileSync(path.join(repo, ".github/workflows/ci.yml"), "name: ci\n");
  writeFileSync(path.join(repo, ".github/actions/example/action.yml"), "name: example\n");
  writeFileSync(path.join(repo, "contracts/agent-task/self.json"), "{}\n");
  writeFileSync(path.join(repo, "scripts/coding-agent-path-guard.mjs"), "// fixture\n");
  writeFileSync(path.join(repo, ".gitignore"), ".env*\nallowed/ignored-link\nignored-cache.txt\n");
  git(repo, "init", "--initial-branch=main");
  git(repo, "config", "user.name", "Path Guard Test");
  git(repo, "config", "user.email", "path-guard@example.invalid");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "fixture");
  writeFileSync(path.join(repo, "ignored-cache.txt"), "baseline\n");

  const manifest = JSON.parse(readFileSync(validManifest, "utf8"));
  manifest.task_id = "P8-T02";
  manifest.runner.credential.scope = "coding-p8-t02";
  manifest.paths = { allowed: ["allowed/**"], forbidden: ["forbidden/**"] };
  manifest.delivery.branch = "agent/P8-T02-path-boundary-guard";
  const manifestPath = path.join(root, "manifest.json");
  const snapshotPath = path.join(root, "snapshot.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { root, repo, manifest, manifestPath, snapshotPath };
}

function phase(context, name) {
  return spawnSync(
    process.execPath,
    [guard, name, "--repo", context.repo, "--manifest", context.manifestPath, "--snapshot", context.snapshotPath],
    { encoding: "utf8", env: { ...process.env, PATH_GUARD_INTEGRITY_KEY: TEST_INTEGRITY_KEY } },
  );
}

function pre(context) {
  const result = phase(context, "pre");
  assert.equal(result.status, 0, result.stderr);
}

function rejectsPost(mutate, pattern) {
  const context = fixture();
  pre(context);
  mutate(context);
  const result = phase(context, "post");
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, pattern);
}

test("FinalArch:COD-001 allows a content change wholly inside the manifest allowlist", () => {
  const context = fixture();
  pre(context);
  writeFileSync(path.join(context.repo, "allowed/source.txt"), "after\n");
  const result = phase(context, "post");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /accepted 1 path change/);
});

test("FinalArch:COD-004 rejects a direct manifest-forbidden write", () => {
  rejectsPost(
    ({ repo }) => writeFileSync(path.join(repo, "forbidden/blocked.txt"), "changed\n"),
    /manifest-forbidden.*forbidden\/blocked\.txt/,
  );
});

test("FinalArch:COD-004 rejects an ignored credential file", () => {
  rejectsPost(
    ({ repo }) => writeFileSync(path.join(repo, ".env.production"), "NOT_A_REAL_SECRET=test\n"),
    /credential.*\.env\.production/,
  );
});

test("FinalArch:COD-004 rejects modification of an existing ignored path outside the allowlist", () => {
  rejectsPost(
    ({ repo }) => writeFileSync(path.join(repo, "ignored-cache.txt"), "changed\n"),
    /outside-allowed.*ignored-cache\.txt/,
  );
});

test("FinalArch:COD-004 rejects a forbidden file hidden by a changed ignore rule", () => {
  const context = fixture();
  context.manifest.paths.allowed.push(".gitignore");
  writeFileSync(context.manifestPath, `${JSON.stringify(context.manifest, null, 2)}\n`);
  pre(context);
  writeFileSync(
    path.join(context.repo, ".gitignore"),
    ".env*\nallowed/ignored-link\nignored-cache.txt\nforbidden/**\n",
  );
  writeFileSync(path.join(context.repo, "forbidden/hidden.txt"), "hidden\n");
  const result = phase(context, "post");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /manifest-forbidden.*forbidden\/hidden\.txt/);
});

test("FinalArch:COD-004 rejects a .git hook insertion", () => {
  rejectsPost(
    ({ repo }) => writeFileSync(path.join(repo, ".git/hooks/post-checkout"), "#!/bin/sh\nexit 0\n"),
    /git-metadata.*\.git/,
  );
});

test("FinalArch:COD-004 rejects workflow governance modification even if manifest allows it", () => {
  const context = fixture();
  context.manifest.paths = { allowed: [".github/**"], forbidden: ["forbidden/**"] };
  writeFileSync(context.manifestPath, `${JSON.stringify(context.manifest, null, 2)}\n`);
  pre(context);
  writeFileSync(path.join(context.repo, ".github/workflows/ci.yml"), "name: compromised\n");
  const result = phase(context, "post");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /governance.*\.github\/workflows\/ci\.yml/);
});

test("FinalArch:COD-004 rejects self-modification of the manifest contract", () => {
  const context = fixture();
  context.manifest.paths = { allowed: ["contracts/**"], forbidden: ["forbidden/**"] };
  writeFileSync(context.manifestPath, `${JSON.stringify(context.manifest, null, 2)}\n`);
  pre(context);
  writeFileSync(path.join(context.repo, "contracts/agent-task/self.json"), '{"changed":true}\n');
  const result = phase(context, "post");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /governance.*contracts\/agent-task\/self\.json/);
});

test("FinalArch:COD-004 rejects self-modification of the path guard", () => {
  const context = fixture();
  context.manifest.paths = { allowed: ["scripts/**"], forbidden: ["forbidden/**"] };
  writeFileSync(context.manifestPath, `${JSON.stringify(context.manifest, null, 2)}\n`);
  pre(context);
  writeFileSync(path.join(context.repo, "scripts/coding-agent-path-guard.mjs"), "// bypass\n");
  const result = phase(context, "post");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /governance.*scripts\/coding-agent-path-guard\.mjs/);
});

test("FinalArch:COD-004 rejects a tampered baseline snapshot", () => {
  const context = fixture();
  pre(context);
  const envelope = JSON.parse(readFileSync(context.snapshotPath, "utf8"));
  envelope.payload.manifestDigest = "0".repeat(64);
  writeFileSync(context.snapshotPath, `${JSON.stringify(envelope)}\n`);
  const result = phase(context, "post");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /snapshot integrity verification failed/);
});

test("FinalArch:COD-004 rejects rename-based boundary swaps", () => {
  rejectsPost(
    ({ repo }) => renameSync(path.join(repo, "allowed/source.txt"), path.join(repo, "forbidden/swapped.txt")),
    /forbidden\/swapped\.txt/,
  );
});

test("FinalArch:COD-004 rejects a forbidden mode-only change", () => {
  rejectsPost(
    ({ repo }) => chmodSync(path.join(repo, "forbidden/blocked.txt"), 0o755),
    /manifest-forbidden.*forbidden\/blocked\.txt/,
  );
});

test("FinalArch:COD-004 rejects an allowed symlink that escapes the repository", () => {
  rejectsPost(({ root, repo }) => {
    const outside = path.join(root, "outside.txt");
    writeFileSync(outside, "outside\n");
    symlinkSync(outside, path.join(repo, "allowed/escape"));
  }, /symlink-escape.*allowed\/escape/);
});

test("FinalArch:COD-004 rejects an allowed symlink into a forbidden path", () => {
  rejectsPost(
    ({ repo }) => symlinkSync("../forbidden/blocked.txt", path.join(repo, "allowed/forbidden-link")),
    /symlink-escape.*allowed\/forbidden-link.*manifest-forbidden/,
  );
});

test("FinalArch:COD-004 rejects an unresolved allowed symlink", () => {
  rejectsPost(
    ({ repo }) => symlinkSync("../missing", path.join(repo, "allowed/dangling")),
    /symlink-escape.*allowed\/dangling.*unresolved/,
  );
});

test("FinalArch:COD-004 rejects an ignored allowed symlink escape", () => {
  rejectsPost(({ root, repo }) => {
    const outside = path.join(root, "ignored-outside.txt");
    writeFileSync(outside, "outside\n");
    symlinkSync(outside, path.join(repo, "allowed/ignored-link"));
  }, /symlink-escape.*allowed\/ignored-link/);
});

test("FinalArch:COD-004 rejects traversal in the validated manifest before snapshotting", () => {
  const context = fixture();
  context.manifest.paths.allowed = ["../escape/**"];
  writeFileSync(context.manifestPath, `${JSON.stringify(context.manifest, null, 2)}\n`);
  const result = phase(context, "pre");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /invalid Draft 2020-12 schema or fixture/);
});
