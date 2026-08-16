// 根拠: FinalArch:PRD-008 / FinalArch:FR-AGT-001..006 / FinalArch:COD-001 / FinalArch:COD-004 / ADR-0027 / WBS P8-T02
import { execFileSync } from "node:child_process";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { pathScopesOverlap, validateAgentTaskManifest } from "../contracts/agent-task/manifest-validator.mjs";

const GOVERNANCE_SCOPES = [
  ".github/workflows/**",
  ".github/actions/**",
  ".github/CODEOWNERS",
  ".github/rulesets/**",
  ".github/branch-protection/**",
  ".github/branch-protection.yml",
  ".github/settings.yml",
  "CODEOWNERS",
  "docs/CODEOWNERS",
  "contracts/agent-task/**",
  "scripts/coding-agent-path-guard.mjs",
  "scripts/coding-agent-path-guard.test.mjs",
];
const CREDENTIAL_NAMES = new Set([".git-credentials", ".netrc", ".npmrc", ".pypirc"]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function integrityKey(options) {
  const key = options.integrityKey ?? process.env.PATH_GUARD_INTEGRITY_KEY;
  if (typeof key !== "string" || Buffer.byteLength(key) < 32) {
    throw new TypeError("PATH_GUARD_INTEGRITY_KEY must contain at least 32 bytes");
  }
  return key;
}

function snapshotHmac(payload, key) {
  return createHmac("sha256", key).update(JSON.stringify(payload)).digest("hex");
}

function git(repoRoot, args, encoding = "utf8") {
  return execFileSync("git", ["-C", repoRoot, ...args], {
    encoding,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

function normalizedRepoPath(value) {
  if (
    value.length === 0 ||
    path.isAbsolute(value) ||
    value.includes("\\") ||
    value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new TypeError(`unsafe repository path: ${JSON.stringify(value)}`);
  }
  return value;
}

function nulPaths(buffer) {
  return new TextDecoder("utf-8", { fatal: true }).decode(buffer).split("\0").filter(Boolean).map(normalizedRepoPath);
}

function recordEntry(absolutePath) {
  const stat = fs.lstatSync(absolutePath);
  const mode = stat.mode & 0o7777;
  if (stat.isSymbolicLink()) return { type: "symlink", mode, sha256: sha256(fs.readlinkSync(absolutePath)) };
  if (stat.isFile()) return { type: "file", mode, sha256: sha256(fs.readFileSync(absolutePath)) };
  if (stat.isDirectory()) return { type: "directory", mode };
  throw new TypeError(`unsupported filesystem entry: ${absolutePath}`);
}

function snapshotTree(treeRoot) {
  const entries = {};
  if (!fs.existsSync(treeRoot)) return entries;
  function visit(directory, relativeDirectory = "") {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const absolutePath = path.join(directory, entry.name);
      entries[relativePath] = recordEntry(absolutePath);
      if (entry.isDirectory()) visit(absolutePath, relativePath);
    }
  }
  visit(treeRoot);
  return entries;
}

function unconditionalReason(repoPath) {
  const segments = repoPath.split("/");
  const name = segments.at(-1).toLowerCase();
  if (GOVERNANCE_SCOPES.some((scope) => pathScopesOverlap(scope, repoPath))) return "governance";
  if (segments.some((segment) => segment === ".aws")) return "credential";
  if (name.startsWith(".env") || name.endsWith(".pem") || CREDENTIAL_NAMES.has(name)) return "credential";
  return undefined;
}

function listWorktreePaths(repoRoot) {
  const paths = new Set([
    ...nulPaths(git(repoRoot, ["ls-files", "-z"], "buffer")),
    ...nulPaths(git(repoRoot, ["ls-files", "--others", "--exclude-standard", "-z"], "buffer")),
    ...nulPaths(git(repoRoot, ["ls-files", "--others", "--ignored", "--exclude-standard", "-z"], "buffer")),
  ]);
  return [...paths].sort();
}

function snapshotWorktree(repoRoot) {
  const entries = {};
  for (const repoPath of listWorktreePaths(repoRoot)) {
    try {
      entries[repoPath] = recordEntry(path.join(repoRoot, repoPath));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return entries;
}

function changedEntries(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .sort();
}

function assertPathAllowed(repoPath, manifest) {
  const hardReason = unconditionalReason(repoPath);
  if (hardReason) throw new TypeError(`${hardReason}: ${repoPath}`);
  if (manifest.paths.forbidden.some((scope) => pathScopesOverlap(scope, repoPath))) {
    throw new TypeError(`manifest-forbidden: ${repoPath}`);
  }
  if (!manifest.paths.allowed.some((scope) => pathScopesOverlap(scope, repoPath))) {
    throw new TypeError(`outside-allowed: ${repoPath}`);
  }
}

function assertSymlinkSafe(repoRoot, repoPath, manifest) {
  const absolutePath = path.join(repoRoot, repoPath);
  if (!fs.lstatSync(absolutePath).isSymbolicLink()) return;
  let resolved;
  try {
    resolved = fs.realpathSync(absolutePath);
  } catch {
    throw new TypeError(`symlink-escape: ${repoPath} has an unresolved target`);
  }
  if (!isInside(repoRoot, resolved)) throw new TypeError(`symlink-escape: ${repoPath} resolves outside repository`);
  const resolvedPath = normalizedRepoPath(path.relative(repoRoot, resolved).split(path.sep).join("/"));
  try {
    assertPathAllowed(resolvedPath, manifest);
  } catch (error) {
    throw new TypeError(`symlink-escape: ${repoPath} resolves to ${resolvedPath} (${error.message})`);
  }
}

function loadManifest(manifestPath) {
  const raw = fs.readFileSync(manifestPath);
  const manifest = JSON.parse(raw);
  validateAgentTaskManifest(manifest);
  return { manifest, digest: sha256(raw) };
}

function resolveContext(options) {
  const repoRoot = fs.realpathSync(options.repo ?? process.cwd());
  const manifestPath = fs.realpathSync(options.manifest);
  const snapshotPath = path.resolve(options.snapshot);
  const gitDir = fs.realpathSync(git(repoRoot, ["rev-parse", "--absolute-git-dir"]).trim());
  if (isInside(repoRoot, snapshotPath) || isInside(gitDir, snapshotPath)) {
    throw new TypeError("snapshot must be outside the repository and Git metadata directory");
  }
  return { repoRoot, manifestPath, snapshotPath, gitDir };
}

export function createPathBoundarySnapshot(options) {
  const context = resolveContext(options);
  const { manifest, digest } = loadManifest(context.manifestPath);
  const dirty = git(context.repoRoot, ["status", "--porcelain=v2", "-z", "--untracked-files=all"], "buffer");
  if (dirty.length > 0) throw new TypeError("precondition failed: checkout is not clean");
  const worktree = snapshotWorktree(context.repoRoot);
  for (const [repoPath, record] of Object.entries(worktree)) {
    if (record.type === "symlink" && manifest.paths.allowed.some((scope) => pathScopesOverlap(scope, repoPath))) {
      assertSymlinkSafe(context.repoRoot, repoPath, manifest);
    }
  }
  const snapshot = {
    version: 1,
    repoRoot: context.repoRoot,
    gitDir: context.gitDir,
    manifestDigest: digest,
    worktree,
    gitMarker: recordEntry(path.join(context.repoRoot, ".git")),
    gitMetadata: snapshotTree(context.gitDir),
  };
  const envelope = { payload: snapshot, hmac: snapshotHmac(snapshot, integrityKey(options)) };
  fs.writeFileSync(context.snapshotPath, `${JSON.stringify(envelope)}\n`, { flag: "wx", mode: 0o600 });
  return Object.keys(worktree).length;
}

export function verifyPathBoundary(options) {
  const snapshotPath = path.resolve(options.snapshot);
  const envelope = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  const expectedHmac = snapshotHmac(envelope.payload, integrityKey(options));
  const actual = Buffer.from(envelope.hmac ?? "", "hex");
  const expected = Buffer.from(expectedHmac, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new TypeError("snapshot integrity verification failed");
  }
  const snapshot = envelope.payload;
  const repoRoot = fs.realpathSync(options.repo ?? process.cwd());
  const manifestPath = fs.realpathSync(options.manifest);
  if (snapshot.version !== 1 || snapshot.repoRoot !== repoRoot) throw new TypeError("snapshot context mismatch");
  if (isInside(repoRoot, snapshotPath) || isInside(snapshot.gitDir, snapshotPath)) {
    throw new TypeError("snapshot must be outside the repository and Git metadata directory");
  }
  const { manifest, digest } = loadManifest(manifestPath);
  if (digest !== snapshot.manifestDigest) throw new TypeError("manifest changed after pre-guard");

  const currentGitDir = fs.realpathSync(git(repoRoot, ["rev-parse", "--absolute-git-dir"]).trim());
  if (currentGitDir !== snapshot.gitDir) throw new TypeError("git-metadata: .git directory changed");
  const gitChanges = changedEntries(snapshot.gitMetadata, snapshotTree(currentGitDir));
  if (JSON.stringify(snapshot.gitMarker) !== JSON.stringify(recordEntry(path.join(repoRoot, ".git")))) {
    gitChanges.unshift("marker");
  }
  if (gitChanges.length > 0) {
    throw new TypeError(`git-metadata: .git/${gitChanges.slice(0, 20).join(", .git/")}`);
  }
  const after = snapshotWorktree(repoRoot);
  const changes = changedEntries(snapshot.worktree, after);
  for (const repoPath of changes) {
    assertPathAllowed(repoPath, manifest);
    if (after[repoPath]?.type === "symlink") assertSymlinkSafe(repoRoot, repoPath, manifest);
  }
  return changes;
}

function parseArguments(argv) {
  const [phase, ...rest] = argv;
  if (phase !== "pre" && phase !== "post")
    throw new TypeError("usage: path-guard <pre|post> --manifest FILE --snapshot FILE [--repo DIR]");
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (!["--manifest", "--snapshot", "--repo"].includes(flag) || value === undefined) {
      throw new TypeError(`invalid argument: ${flag ?? "<missing>"}`);
    }
    options[flag.slice(2)] = value;
  }
  if (!options.manifest || !options.snapshot) throw new TypeError("--manifest and --snapshot are required");
  return { phase, options };
}

function main() {
  const { phase, options } = parseArguments(process.argv.slice(2));
  if (phase === "pre") {
    const count = createPathBoundarySnapshot(options);
    process.stdout.write(`[path-guard] baseline recorded for ${count} worktree path(s)\n`);
  } else {
    const changes = verifyPathBoundary(options);
    process.stdout.write(`[path-guard] accepted ${changes.length} path change(s)\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`[path-guard] reject: ${error.message}\n`);
    process.exitCode = 1;
  }
}
