/**
 * packages/traceability/src/verifyTraceability.ts
 *
 * 根拠: PrjOps:REQ-043 / PrjOps:SPEC-INT-070 / PrjOps:AC-043-1 /
 *   DevOps:REQ-033 / DevOps:SPEC-INT-084 / DevOps:AC-033a。
 * 目的: 「仕様と実装コード」「仕様と検証コード」の相互参照を機械的に検証する。
 *   - packages/traceability/spec-ids/*.json に列挙された各ID（REQ/SPEC-EXT/SPEC-INT/TH/AC等）が、
 *     対応するsrc/配下（実装コード）およびtests/配下（検証コード）のコメント・文字列中に
 *     少なくとも1回参照されているかを確認する。
 *   - DOC-05 §11 実装完了の定義「本表の全SPEC-INTについて、対応するREQのACを検証するテストが存在し
 *     合格していること」に対応する機械チェックとして機能する。
 *   - docs/spec/spec-id-catalog.md と spec-ids/*.json の全IDを照合し、定義・正本リンクの構造的完全性を
 *     検証する。これは定義文の意味的正しさや要件充足を保証するものではない。
 *
 * 制約: 本スクリプトは「参照されているか（文字列一致）」のみを確認する構文的チェックであり、
 *   実装の意味的正しさまでは保証しない（意味的正しさはテストの合否で担保する。README参照）。
 *   REQ/SPEC-INT/TH（要件・内部仕様・閾値）は実装必須と位置づけ、コード参照0件を検出エラーとする。
 *   ISS/TOBE/ASM（現状課題・将来プロセス・仮定）は文書間トレーサビリティの記録用IDであり、
 *   実装コードへの直接参照を必須としない（警告のみ）。
 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { format as formatMarkdown } from "prettier";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");

interface SpecIndex {
  system: string;
  REQ?: string[];
  "SPEC-EXT"?: string[];
  "SPEC-INT"?: string[];
  TH?: string[];
  ISS?: string[];
  TOBE?: string[];
  ASM?: string[];
  AC?: string[];
  dispositions?: ImplementationDisposition[];
}

type ImplementationDispositionStatus = "partial" | "superseded";

interface ImplementationDisposition {
  id: string;
  status: ImplementationDispositionStatus;
  completed: string[];
  remaining?: string[];
  superseded_by?: string[];
  retained_obligations?: string[];
  basis: string[];
  owner: string;
}

function loadSpecIndex(file: string): SpecIndex {
  return JSON.parse(readFileSync(file, "utf8")) as SpecIndex;
}

function listFiles(dir: string, exts: string[], out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === "dist" || entry === ".git") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) listFiles(full, exts, out);
    else if (exts.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

interface FileCorpus {
  srcText: string;
  testText: string;
}

interface ParsedReferences {
  canonical: Set<string>;
  bare: Set<string>;
  failures: string[];
}

const SPEC_ID_PATTERN =
  "(?:REQ|SPEC-(?:EXT|INT)|TH)-\\d{3}|AC-\\d{3}(?:-\\d+|[a-z])?|ISS-\\d{2,3}|TOBE-\\d{2}|ASM-\\d{3}";
const SPEC_CATEGORIES = ["REQ", "SPEC-EXT", "SPEC-INT", "TH", "ISS", "TOBE", "ASM", "AC"] as const;
type SpecCategory = (typeof SPEC_CATEGORIES)[number];

const ID_PATTERN_BY_CATEGORY: Record<SpecCategory, RegExp> = {
  REQ: /^REQ-\d{3}$/,
  "SPEC-EXT": /^SPEC-EXT-\d{3}$/,
  "SPEC-INT": /^SPEC-INT-\d{3}$/,
  TH: /^TH-\d{3}$/,
  ISS: /^ISS-\d{2,3}$/,
  TOBE: /^TOBE-\d{2}$/,
  ASM: /^ASM-\d{3}$/,
  AC: /^AC-\d{3}(?:-\d+|[a-z])?$/,
};

function indexedIds(index: SpecIndex): Set<string> {
  return new Set(
    Object.entries(index)
      .filter(
        (entry): entry is [string, string[]] =>
          entry[0] !== "system" && entry[0] !== "dispositions" && Array.isArray(entry[1]),
      )
      .flatMap(([, ids]) => ids),
  );
}

function specIndexFailures(indexes: SpecIndex[]): string[] {
  const failures = new Set<string>();
  const seenSystems = new Set<string>();
  for (const index of indexes) {
    if (!(["PrjOps", "DevOps"] as const).includes(index.system as "PrjOps" | "DevOps")) {
      failures.add(`invalid spec index system: ${index.system}`);
    }
    if (seenSystems.has(index.system)) failures.add(`duplicate spec index system: ${index.system}`);
    seenSystems.add(index.system);

    const seenIds = new Map<string, string>();
    for (const [key, value] of Object.entries(index)) {
      if (key === "system" || key === "dispositions") continue;
      if (!SPEC_CATEGORIES.includes(key as SpecCategory) || !Array.isArray(value)) {
        failures.add(`invalid spec index category: ${index.system}:${key}`);
        continue;
      }
      const category = key as SpecCategory;
      for (const id of value) {
        if (typeof id !== "string" || !ID_PATTERN_BY_CATEGORY[category].test(id)) {
          failures.add(`spec index category mismatch: ${index.system}:${String(id)} under ${category}`);
          continue;
        }
        const previous = seenIds.get(id);
        if (previous) failures.add(`duplicate spec index ID: ${index.system}:${id} under ${previous}/${category}`);
        else seenIds.set(id, category);
      }
    }
  }
  return [...failures].sort();
}

function parseReferences(
  text: string,
  knownBySystem: ReadonlyMap<string, ReadonlySet<string>>,
  collidingIds: ReadonlySet<string>,
): ParsedReferences {
  const canonical = new Set<string>();
  const bare = new Set<string>();
  const failures = new Set<string>();
  const canonicalPattern = new RegExp(`\\b(PrjOps|DevOps):(${SPEC_ID_PATTERN})(?![A-Za-z0-9_-])`, "g");
  const knownSystemPattern = new RegExp(`\\b(PrjOps|DevOps)([\\t :/]+)(${SPEC_ID_PATTERN})(?![A-Za-z0-9_-])`, "g");
  const unknownSystemPattern = new RegExp(`\\b([A-Za-z][A-Za-z0-9_-]*)(:+)(${SPEC_ID_PATTERN})(?![A-Za-z0-9_-])`, "g");
  const canonicalCandidatePattern = /\b([A-Za-z][A-Za-z0-9_-]*):([A-Za-z0-9_-]+)/g;
  const validIdPattern = new RegExp(`^(?:${SPEC_ID_PATTERN})$`);
  const barePattern = new RegExp(`(?<![A-Za-z0-9_-])(${SPEC_ID_PATTERN})(?![A-Za-z0-9_-])`, "g");

  for (const match of text.matchAll(canonicalPattern)) {
    const system = match[1]!;
    const id = match[2]!;
    const reference = `${system}:${id}`;
    if (knownBySystem.get(system)?.has(id)) canonical.add(reference);
    else failures.add(`unknown canonical reference: ${reference}`);
  }

  for (const match of text.matchAll(knownSystemPattern)) {
    if (match[2] !== ":") failures.add(`malformed canonical reference: ${match[0]}`);
  }

  for (const match of text.matchAll(unknownSystemPattern)) {
    if (!knownBySystem.has(match[1]!)) failures.add(`unknown traceability system: ${match[0]}`);
  }

  for (const match of text.matchAll(canonicalCandidatePattern)) {
    const isKnownSystem = knownBySystem.has(match[1]!);
    const isValidId = validIdPattern.test(match[2]!);
    if (isKnownSystem && !isValidId) failures.add(`malformed canonical reference: ${match[0]}`);
    else if (!isKnownSystem && isValidId) failures.add(`unknown traceability system: ${match[0]}`);
  }

  for (const match of text.matchAll(barePattern)) {
    const id = match[1]!;
    const lineStart = text.lastIndexOf("\n", match.index! - 1) + 1;
    const prefix = text.slice(lineStart, match.index);
    if (/[A-Za-z][A-Za-z0-9_-]*:+$/.test(prefix) || /(?:PrjOps|DevOps)[\t :/]+$/.test(prefix)) continue;
    bare.add(id);
    if (collidingIds.has(id)) failures.add(`ambiguous bare reference: ${id}`);
  }

  return { canonical, bare, failures: [...failures] };
}

function namespaceFailuresByFile(
  repoRoot: string,
  packageDirs: string[],
  knownBySystem: ReadonlyMap<string, ReadonlySet<string>>,
  collidingIds: ReadonlySet<string>,
  ignoredFiles: ReadonlySet<string> = new Set(),
): string[] {
  const files = packageDirs
    .flatMap((pkgDir) => [
      ...listFiles(join(pkgDir, "src"), [".ts", ".sql", ".yml", ".yaml"]),
      ...listFiles(join(pkgDir, "tests"), [".ts"]),
    ])
    .filter((file) => !ignoredFiles.has(file));
  return [
    ...new Set(
      files.flatMap((file) => {
        const relativeFile = file.replace(`${repoRoot}${sep}`, "");
        return parseReferences(readFileSync(file, "utf8"), knownBySystem, collidingIds).failures.map(
          (failure) => `${failure} [${relativeFile}]`,
        );
      }),
    ),
  ].sort();
}

function buildCorpus(packageDirs: string[]): FileCorpus {
  let srcText = "";
  let testText = "";
  for (const pkgDir of packageDirs) {
    const srcFiles = listFiles(join(pkgDir, "src"), [".ts", ".sql", ".yml", ".yaml"]);
    const testFiles = listFiles(join(pkgDir, "tests"), [".ts"]);
    for (const f of srcFiles) srcText += readFileSync(f, "utf8") + "\n";
    for (const f of testFiles) testText += readFileSync(f, "utf8") + "\n";
  }
  return { srcText, testText };
}

export interface CategoryResult {
  category: string;
  total: number;
  inSrc: number;
  inTest: number;
  missingFromSrc: string[];
  missingFromTest: string[];
}

export function collectFailureMessages(
  results: CategoryResult[],
  basisFailures: string[],
  adrFailures: string[],
  referenceFailures: string[] = [],
  dispositionFailures: string[] = [],
  catalogFailures: string[] = [],
): string[] {
  const mandatory = results.filter((result) => ["REQ", "SPEC-INT", "TH"].includes(result.category));
  return [
    ...mandatory.flatMap((result) => result.missingFromSrc),
    ...basisFailures.map((file) => `basis header missing: ${file}`),
    ...adrFailures.map((id) => `ADR reference missing file: ${id}`),
    ...referenceFailures,
    ...dispositionFailures,
    ...catalogFailures,
  ];
}

/**
 * 設定変数の三者一致ガード（根拠: ADR-0005。所見 ADV-OPS-012）。
 *
 * `docs/reference/configuration.md` は自ら「二つの Zod スキーマの全キーを列挙し、`.env.example`
 * も同じ和集合を持つ」と主張している。この主張を人手で維持していた間に 16 変数が文書から、
 * 5 変数が `.env.example` から欠落した。文書の主張は検証可能でなければ主張ではないので、
 * 乖離した時点で `mise run traceability` が落ちるようにする。
 *
 * 抽出は構文解析ではなく形（スキーマ本体のキー行 / 表のバッククォート付き大文字トークン /
 * `KEY=` 行）に依存する。取りこぼしではなく過検出へ倒してあり、疑わしい側は失敗になる。
 */
export function configInventoryFailures(repoRoot: string): string[] {
  const read = (...parts: string[]): string | undefined => {
    try {
      return readFileSync(join(repoRoot, ...parts), "utf8");
    } catch {
      return undefined;
    }
  };
  const serverSource = read("packages", "server", "src", "config.ts");
  const webSource = read("packages", "web", "src", "server", "config.ts");
  const docSource = read("docs", "reference", "configuration.md");
  const envSource = read(".env.example");
  const missingFiles = [
    serverSource === undefined ? "packages/server/src/config.ts" : undefined,
    webSource === undefined ? "packages/web/src/server/config.ts" : undefined,
    docSource === undefined ? "docs/reference/configuration.md" : undefined,
    envSource === undefined ? ".env.example" : undefined,
  ].filter((file): file is string => file !== undefined);
  if (missingFiles.length > 0) return missingFiles.map((file) => `config inventory source missing: ${file}`);

  const between = (text: string, from: string, to: string): string => {
    const start = text.indexOf(from);
    if (start < 0) return "";
    const end = text.indexOf(to, start + from.length);
    return text.slice(start, end < 0 ? text.length : end);
  };
  // 名前の形を狭く決め打つと、そこから外れたキーが3つの抽出すべてから漏れ、
  // 他のキーが残るので空スキーマ判定にも掛からず、key-for-key の保証が静かに破れる。
  // 大文字限定 → 3文字以上 → `_` 始まり不可、と個別に穴が見つかった経緯があるため、
  // 識別子として妥当な形すべてを受ける。クォート付きキー（`"KEY": z.string()`）も拾う。
  //
  // 広く取ると本来キーでない行を拾い得るが、その場合に起きるのは「文書に足せ」という失敗であり、
  // 漏らした場合に起きる「気づかないまま緑」より安全な方向である。意図的にこちら側へ倒している。
  const IDENTIFIER = String.raw`[A-Za-z_$][A-Za-z0-9_$]*`;
  const namedProperty = new RegExp(String.raw`^\s{2,4}"?(${IDENTIFIER})"?\s*:`);
  // shorthand プロパティ（`{ NEW_FLAG }`）はコロンを持たないので、名前付きの形だけを見ていると漏れる。
  const shorthandProperty = new RegExp(String.raw`^\s{2,4}(${IDENTIFIER})\s*,\s*$`);

  /**
   * Zod オブジェクト本体からキー名を取り出す。
   *
   * shorthand は「識別子1つとカンマだけの行」だが、複数行に跨る呼び出しの引数
   * （`refine(\n  (x) => ...,\n  "message",\n)` の途中行）も同じ形になり得る。
   *
   * 両者はインデントで区別する。プロパティ行は同じ深さに揃い、呼び出しの引数はそれより
   * 1 段深い。基準の深さは決め打たず、名前付きプロパティが実際に現れる最小インデントから
   * 導く（server は 2、web は `.object({` の内側なので 4）。
   *
   * 文字を数えて括弧の深さを追う方法は採らない。文字列リテラル・テンプレート・コメント・
   * 正規表現の中の括弧を除外する必要があり、それは字句解析そのものになる（`z.literal("(")`
   * 一つで狂う）。インデントは Prettier が正規化し、`mise run format` が CI ゲートとして
   * 強制しているので、この判別材料は機械的に保証されている。
   */
  const schemaKeys = (body: string): string[] => {
    const lines = body.split("\n");
    const indentOf = (line: string): number => (/^(\s*)/.exec(line)?.[1] ?? "").length;

    const keys = new Set<string>();
    let propertyIndent: number | undefined;
    for (const line of lines) {
      const named = namedProperty.exec(line);
      if (!named) continue;
      keys.add(named[1]!);
      propertyIndent = Math.min(propertyIndent ?? indentOf(line), indentOf(line));
    }
    if (propertyIndent !== undefined) {
      for (const line of lines) {
        if (indentOf(line) !== propertyIndent) continue;
        const shorthand = shorthandProperty.exec(line);
        if (shorthand) keys.add(shorthand[1]!);
      }
    }
    return [...keys];
  };
  const tableKeys = (section: string): Set<string> =>
    new Set(
      [...section.matchAll(new RegExp(String.raw`^\|\s*\`(${IDENTIFIER})\`\s*\|`, "gm"))].map((match) => match[1]!),
    );

  /**
   * キー集合を書き換える Zod の合成メソッド。抽出は単一のオブジェクトリテラルしか読まないので、
   * これらが使われた時点で結果は実際のスキーマと一致しなくなる。
   *
   * 読めないものを黙って読み飛ばすと、`.extend({ NEW_FLAG })` で足したキーが文書からも
   * 漏れたまま緑になる——本ガードが防ぐはずの回帰そのものが素通りする。追随を実装する代わりに、
   * 「読めない形が現れた」ことを失敗として報告する。合成を導入する側が抽出器も直す前提にする。
   */
  const COMPOSITION_METHODS = [
    ".extend(",
    ".safeExtend(",
    ".merge(",
    ".omit(",
    ".pick(",
    ".partial(",
    ".required(",
    ".and(",
  ];
  const compositionFailure = (source: string, label: string): string | undefined => {
    const used = COMPOSITION_METHODS.filter((method) => source.includes(method));
    if (used.length === 0) return undefined;
    return `config inventory: ${label} uses ${used.join(" / ")}; the extractor reads one object literal and cannot follow composed schemas`;
  };

  /**
   * オブジェクトスプレッド（`{ ...extraShape, PORT: ... }`）も合成である。
   * 展開元は別の変数なので、本体を読むだけでは持ち込まれるキーが分からない。
   * Zod のメソッドと同じ扱いで、読めない形として失敗させる。
   */
  const spreadFailure = (body: string, label: string): string | undefined =>
    /^\s*\.\.\./m.test(body)
      ? `config inventory: ${label} spreads another object into the schema; the extractor cannot resolve the keys it contributes`
      : undefined;

  /**
   * 計算プロパティ（`[NEW_FLAG]: z.string()`）も同じ理由で読めない。キー名は別の束縛にあり、
   * 本体を読むだけでは決まらない。スプレッド・合成と同じく、推測せず失敗として報告する。
   */
  const computedKeyFailure = (body: string, label: string): string | undefined =>
    /^\s{2,4}\[/m.test(body)
      ? `config inventory: ${label} uses a computed property key; the extractor cannot resolve the name it evaluates to`
      : undefined;

  const serverBody = between(serverSource!, "const baseConfigSchema", "const configSchema");
  const webBody = between(webSource!, "const webConfigSchema", ".superRefine");
  const serverKeys = schemaKeys(serverBody);
  const webKeys = schemaKeys(webBody);
  const compositionFailures = [
    compositionFailure(serverSource!, "packages/server/src/config.ts"),
    compositionFailure(webSource!, "packages/web/src/server/config.ts"),
    spreadFailure(serverBody, "packages/server/src/config.ts"),
    spreadFailure(webBody, "packages/web/src/server/config.ts"),
    computedKeyFailure(serverBody, "packages/server/src/config.ts"),
    computedKeyFailure(webBody, "packages/web/src/server/config.ts"),
  ].filter((failure): failure is string => failure !== undefined);
  if (compositionFailures.length > 0) return compositionFailures;
  const docServer = tableKeys(between(docSource!, "## Server", "## Web"));
  const docWeb = tableKeys(between(docSource!, "## Web", "## Report Generation"));
  const envKeys = new Set(
    [...envSource!.matchAll(new RegExp(String.raw`^#?\s*(${IDENTIFIER})=`, "gm"))].map((match) => match[1]!),
  );

  // スキーマ本体を読めていない場合に空集合同士が一致して黙って通るのを防ぐ。
  if (serverKeys.length === 0 || webKeys.length === 0) {
    return ["config inventory: Zod schema body not found; the extraction anchors in verifyTraceability.ts are stale"];
  }

  const failures: string[] = [];
  const report = (keys: string[], present: Set<string>, label: string): void => {
    for (const key of keys) {
      if (!present.has(key)) failures.push(`config inventory: ${key} is in the ${label}`);
    }
  };
  report(serverKeys, docServer, "server Zod schema but not in the configuration.md server table");
  report(webKeys, docWeb, "web Zod schema but not in the configuration.md web table");
  report([...serverKeys, ...webKeys], envKeys, "Zod schemas but not in .env.example");

  // 逆向きは表ごとに突合する。両表と両スキーマを合算して比べると、web 専用の
  // AUTH_SECRET が server 表に載っていても通ってしまい、表が「そのスキーマの
  // インベントリである」という主張が崩れたまま CI は緑になる。
  const reverse = (documented: Set<string>, schema: string[], label: string): void => {
    const schemaSet = new Set(schema);
    for (const key of documented) {
      if (!schemaSet.has(key)) failures.push(`config inventory: ${key} is in the ${label}`);
    }
  };
  reverse(docServer, serverKeys, "configuration.md server table but not in the server Zod schema");
  reverse(docWeb, webKeys, "configuration.md web table but not in the web Zod schema");

  // .env.example は両スキーマの和集合を持つので、こちらは合算のまま比べる。
  const schemaKeySet = new Set([...serverKeys, ...webKeys]);
  for (const key of envKeys) {
    if (!schemaKeySet.has(key)) {
      failures.push(`config inventory: ${key} is in .env.example but is in neither Zod schema`);
    }
  }
  return [...new Set(failures)];
}

function catalogFailures(repoRoot: string, indexes: SpecIndex[]): string[] {
  const catalogFile = join(repoRoot, "docs", "spec", "spec-id-catalog.md");
  let text: string;
  try {
    text = readFileSync(catalogFile, "utf8");
  } catch {
    return ["spec ID catalog missing: docs/spec/spec-id-catalog.md"];
  }

  const failures = new Set<string>();
  const expectedBySystem = new Map(indexes.map((index) => [index.system, indexedIds(index)]));
  const seen = new Map<string, number>();
  const sectionPattern = /^## (PrjOps|DevOps)\s*$/gm;
  const sections = [...text.matchAll(sectionPattern)];
  const canonicalPattern = new RegExp(`^(PrjOps|DevOps):(${SPEC_ID_PATTERN})$`);
  const resolvedRepoRoot = resolve(repoRoot);
  const expectedMirrorSource: Record<string, Partial<Record<SpecCategory, string>>> = {
    PrjOps: {
      REQ: "prjops/03_PRD.md",
      "SPEC-EXT": "prjops/04_外部仕様書.md",
      "SPEC-INT": "prjops/05_内部仕様書.md",
      ISS: "prjops/01_現状分析_AS-IS.md",
      TOBE: "prjops/02_将来プロセス設計_TO-BE.md",
      ASM: "prjops/00_README_文書体系と共通定義.md",
      AC: "prjops/03_PRD.md",
    },
    DevOps: {
      REQ: "devops/02_PRD.md",
      "SPEC-EXT": "devops/03_外部仕様書.md",
      "SPEC-INT": "devops/04_内部仕様書.md",
      TH: "devops/01_現状分析と再設計.md",
      ISS: "devops/01_現状分析と再設計.md",
      AC: "devops/02_PRD.md",
    },
  };

  const categoryForId = (id: string): string => {
    if (id.startsWith("SPEC-EXT-")) return "SPEC-EXT";
    if (id.startsWith("SPEC-INT-")) return "SPEC-INT";
    return id.split("-")[0]!;
  };

  const fragmentSpan = (file: string, fragment: string): string | undefined => {
    const sourceText = readFileSync(file, "utf8");
    const sourceLines = sourceText.split("\n");
    const lineFragment = /^L(\d+)(?:-L(\d+))?$/.exec(fragment);
    if (lineFragment) {
      const start = Number(lineFragment[1]);
      const end = Number(lineFragment[2] ?? lineFragment[1]);
      if (start < 1 || end < start || end > sourceLines.length) return undefined;
      return sourceLines.slice(start - 1, end).join("\n");
    }
    const heading = sourceLines.find(
      (line) =>
        /^#{1,6}\s/.test(line) &&
        line
          .replace(/^#{1,6}\s+/, "")
          .replace(/[`*_]/g, "")
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s-]/gu, "")
          .trim()
          .replace(/\s+/g, "-") === fragment.toLowerCase(),
    );
    return heading;
  };

  const spanDefinesId = (span: string, system: string, id: string): boolean => {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![A-Za-z0-9_-])(?:${system}:)?${escaped}(?![A-Za-z0-9_-])`).test(span);
  };

  const spanStartsDefinition = (span: string, id: string): boolean => {
    const firstLine =
      span
        .split("\n")
        .find((line) => line.trim())
        ?.trim() ?? "";
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const boundary = "(?=\\s|[|:：(（]|$)";
    const ids = [...firstLine.matchAll(new RegExp(`(?<![A-Za-z0-9_-])(${SPEC_ID_PATTERN})(?![A-Za-z0-9_-])`, "g"))].map(
      (match) => match[1]!,
    );
    const isSoleId = ids.length === 1 && ids[0] === id;
    if (/^#{1,6}\s+/.test(firstLine)) return ids[0] === id;
    if (new RegExp(`^[-*]\\s+(?:\\*\\*)?${escaped}(?:\\*\\*)?${boundary}`).test(firstLine)) return true;

    const boldTitle = /^\*\*([^*]+)\*\*/.exec(firstLine)?.[1] ?? /共通仕様\s+\*\*([^*]+)\*\*/.exec(firstLine)?.[1];
    if (boldTitle && spanDefinesId(boldTitle, "", id)) return true;

    if (firstLine.startsWith("|")) {
      if (isSoleId) return true;
      return firstLine
        .slice(1, firstLine.endsWith("|") ? -1 : undefined)
        .split("|")
        .some((cell) => new RegExp(`^(?:\\*\\*)?${escaped}(?:\\*\\*)?${boundary}`).test(cell.trim()));
    }
    return false;
  };

  for (const system of ["PrjOps", "DevOps"]) {
    const count = sections.filter((section) => section[1] === system).length;
    if (count !== 1) failures.add(`catalog system section count: ${system}=${count}`);
  }

  for (const [position, section] of sections.entries()) {
    const sectionSystem = section[1]!;
    const start = section.index! + section[0].length;
    const end = sections[position + 1]?.index ?? text.length;
    let category = "";
    for (const line of text.slice(start, end).split("\n")) {
      if (line.startsWith("### ")) {
        const categoryHeading = /^### (REQ|SPEC-EXT|SPEC-INT|TH|ISS|TOBE|ASM|AC)\s*$/.exec(line);
        category = categoryHeading?.[1] ?? "";
        continue;
      }
      if (!line.startsWith("|")) continue;
      const cells = line
        .slice(1, line.endsWith("|") ? -1 : undefined)
        .split("|")
        .map((cell) => cell.trim());
      const token = cells[0]?.replace(/^`|`$/g, "") ?? "";
      if (token === "ID" || /^-+$/.test(token)) continue;
      if (!token.match(/(?:REQ|SPEC-|TH-|AC-|ISS-|TOBE-|ASM-)/)) continue;
      if (cells.length !== 4) {
        failures.add(`malformed catalog row: ${token}`);
        continue;
      }

      const canonical = canonicalPattern.exec(token);
      if (!canonical) {
        failures.add(`malformed catalog ID: ${token}`);
        continue;
      }
      const [, rowSystem, id] = canonical;
      seen.set(token, (seen.get(token) ?? 0) + 1);
      if (rowSystem !== sectionSystem) {
        failures.add(`wrong catalog system: ${token} under ${sectionSystem}`);
      }
      if (!expectedBySystem.get(rowSystem!)?.has(id!)) {
        failures.add(`unknown catalog ID: ${token}`);
      }
      if (category !== categoryForId(id!)) {
        failures.add(`catalog category mismatch: ${token} under ${category || "unclassified"}`);
      }

      const definition = cells[1] ?? "";
      if (!definition || /^(?:—|-|TBD|TODO)$/i.test(definition)) {
        failures.add(`catalog definition missing: ${token}`);
      } else if (!/[\p{L}\p{N}]/u.test(definition.replace(/\[[^\]]*\]\([^)]+\)/g, ""))) {
        failures.add(`catalog definition is only a link: ${token}`);
      }
      const source = cells[2] ?? "";
      const localLinks = [...source.matchAll(/\]\(([^)]+)\)/g)]
        .map((match) => match[1]!)
        .filter((target) => !/^[a-z]+:/i.test(target));
      if (localLinks.length === 0) failures.add(`catalog source missing: ${token}`);
      for (const target of localLinks) {
        const [path, fragment] = target.split("#", 2);
        const resolved = resolve(dirname(catalogFile), path!);
        if (resolved !== resolvedRepoRoot && !resolved.startsWith(`${resolvedRepoRoot}${sep}`)) {
          failures.add(`catalog source outside repository: ${token}`);
          continue;
        }
        if (!statSyncSafe(resolved)) {
          failures.add(`catalog source missing: ${token}`);
          continue;
        }
        const normalizedSourcePath = relative(dirname(catalogFile), resolved).split(sep).join("/");
        const mirrorPath = /^(prjops|devops)\/.+\.md$/.test(normalizedSourcePath) ? normalizedSourcePath : undefined;
        if (mirrorPath) {
          const expectedPath = expectedMirrorSource[rowSystem!]![categoryForId(id!) as SpecCategory];
          if (mirrorPath !== expectedPath) {
            failures.add(`catalog source document mismatch: ${token}`);
            continue;
          }
          if (!fragment) {
            failures.add(`catalog source fragment missing: ${token}`);
            continue;
          }
        }
        if (fragment) {
          const span = fragmentSpan(resolved, fragment);
          if (!span) {
            failures.add(`catalog source fragment missing: ${token}`);
            continue;
          }
          const explicitIdAnchor = /^(?:prjops|devops)(?:req|spec-|ac)/.test(fragment.toLowerCase());
          if (mirrorPath && !spanStartsDefinition(span, id!)) {
            failures.add(`catalog source does not define: ${token}`);
          } else if (explicitIdAnchor && !spanDefinesId(span, rowSystem!, id!)) {
            failures.add(`catalog source does not define: ${token}`);
          }
        }
      }
    }
  }

  for (const [canonical, count] of seen) {
    if (count > 1) failures.add(`duplicate catalog ID: ${canonical}`);
  }
  for (const index of indexes) {
    for (const id of indexedIds(index)) {
      const canonical = `${index.system}:${id}`;
      if (!seen.has(canonical)) failures.add(`catalog ID missing: ${canonical}`);
    }
  }
  return [...failures].sort();
}

function dispositionFailures(repoRoot: string, index: SpecIndex): string[] {
  const failures: string[] = [];
  const known = indexedIds(index);
  const seen = new Set<string>();
  for (const disposition of index.dispositions ?? []) {
    const canonical = `${index.system}:${disposition.id}`;
    if (!known.has(disposition.id)) failures.push(`unknown disposition ID: ${canonical}`);
    if (seen.has(disposition.id)) failures.push(`duplicate disposition ID: ${canonical}`);
    seen.add(disposition.id);
    if (!(["partial", "superseded"] as const).includes(disposition.status)) {
      failures.push(`invalid disposition status: ${canonical}`);
    }
    const requiredArrays: Array<[string, string[] | undefined]> = [
      ["completed", disposition.completed],
      ["basis", disposition.basis],
    ];
    if (disposition.status === "superseded") {
      requiredArrays.push(
        ["superseded_by", disposition.superseded_by],
        ["retained_obligations", disposition.retained_obligations],
      );
    } else {
      requiredArrays.push(["remaining", disposition.remaining]);
    }
    for (const [field, values] of requiredArrays) {
      if (
        !Array.isArray(values) ||
        values.length === 0 ||
        values.some((value) => typeof value !== "string" || !value.trim())
      ) {
        failures.push(`invalid disposition ${field}: ${canonical}`);
      }
    }
    if (typeof disposition.owner !== "string" || !disposition.owner.trim()) {
      failures.push(`invalid disposition owner: ${canonical}`);
    }
    for (const path of Array.isArray(disposition.basis) ? disposition.basis : []) {
      const resolved = resolve(repoRoot, path);
      if (!resolved.startsWith(`${resolve(repoRoot)}${sep}`) || !statSyncSafe(resolved)) {
        failures.push(`disposition basis missing: ${path}`);
      }
    }
  }
  return failures;
}

function statSyncSafe(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function checkCategory(
  ids: string[] | undefined,
  category: string,
  system: string,
  corpus: { src: ParsedReferences; test: ParsedReferences },
  collidingIds: ReadonlySet<string>,
): CategoryResult {
  const list = ids ?? [];
  const missingFromSrc: string[] = [];
  const missingFromTest: string[] = [];
  let inSrc = 0;
  let inTest = 0;
  for (const id of list) {
    const canonical = `${system}:${id}`;
    const inS = corpus.src.canonical.has(canonical) || (!collidingIds.has(id) && corpus.src.bare.has(id));
    const inT = corpus.test.canonical.has(canonical) || (!collidingIds.has(id) && corpus.test.bare.has(id));
    if (inS) inSrc += 1;
    else missingFromSrc.push(canonical);
    if (inT) inTest += 1;
    else missingFromTest.push(canonical);
  }
  return { category, total: list.length, inSrc, inTest, missingFromSrc, missingFromTest };
}

function pct(n: number, total: number): string {
  if (total === 0) return "100";
  return ((n / total) * 100).toFixed(0);
}

function markdownTable(headers: string[], rows: string[][]): string[] {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]?.length ?? 0)));
  const formatRow = (cells: string[]) => `| ${cells.map((c, i) => c.padEnd(widths[i]!)).join(" | ")} |`;
  return [
    formatRow(headers),
    `| ${widths.map((w) => "-".repeat(w)).join(" | ")} |`,
    ...rows.map((row) => formatRow(row)),
  ];
}

function formatResults(systemName: string, results: CategoryResult[]): string {
  const rows = results.map((r) => [
    r.category,
    String(r.total),
    `${r.inSrc} (${pct(r.inSrc, r.total)}%)`,
    `${r.inTest} (${pct(r.inTest, r.total)}%)`,
    r.missingFromSrc.join(", ") || "—",
  ]);
  const lines: string[] = [
    `## ${systemName}`,
    "",
    ...markdownTable(["カテゴリ", "総数", "source参照あり", "テスト参照あり", "source参照なし"], rows),
  ];
  return lines.join("\n");
}

function formatDispositions(indexes: SpecIndex[]): string {
  const rows = indexes.flatMap((index) =>
    (index.dispositions ?? []).map((item) => [
      `${index.system}:${item.id}`,
      item.status,
      item.superseded_by?.join("<br>") ?? "—",
      item.completed.join("<br>"),
      (item.status === "superseded" ? item.retained_obligations : item.remaining)?.join("<br>") ?? "—",
      item.basis.join("<br>"),
      item.owner,
    ]),
  );
  if (rows.length === 0) return "";
  return [
    "## Implementation Dispositions",
    "",
    "この表はsource参照の存在と要件完了を分離する。`partial`は未完了、`superseded`は原仕様を置換済みだが保持義務の完了を意味せず、greenの完成証明ではない。",
    "",
    ...markdownTable(["ID", "状態", "置換先", "実装済み範囲", "未完了・保持義務", "根拠", "Owner"], rows),
  ].join("\n");
}

/**
 * 根拠ヘッダガードの走査対象（所見 ADV-VER-005）。
 *
 * AGENTS.md 設計原則3 は「新規ファイルの先頭コメントに根拠となる仕様IDを記載する。
 * `mise run traceability` が検証する」と述べるが、実際の走査は shared/src/reporting と
 * server/src の 2 ディレクトリだけで、prjops / devops / web / traceability /
 * shared の reporting 以外は規約の外に置かれていた。規約が自己申告どおりの範囲を
 * 持つよう、全パッケージの src/ を対象にする。
 */
/**
 * 根拠ヘッダとして受け付ける ID の文法。AGENTS.md 設計原則3 が列挙する
 * REQ / SPEC-INT / SPEC-EXT / TH / AC / ADR に揃える（ISS/TOBE/ASM は文書間トレーサビリティ用で
 * 実装の根拠にはならないため含めない）。
 *
 * 桁数と前後の境界まで含めて一致させる。前方境界が無いと `MONTH-001` の語中が `TH-001` に、
 * 後方境界が無いと `REQ-00000` の先頭 4 桁が `REQ-0000` に一致してしまい、**実在しない ID を
 * 書いたヘッダがガードを通る**。桁数だけを緩く見る書き方は、ここでは穴になる。
 */
const BASIS_ID_PATTERN = String.raw`(?:REQ|SPEC-EXT|SPEC-INT|TH)-\d{3}|AC-\d{3}(?:-\d+|[a-z])?|ADR-\d{4}`;
const BASIS_HEADER_ID = new RegExp(String.raw`根拠:[\s\S]*(?<![A-Za-z0-9_-])(?:${BASIS_ID_PATTERN})(?![0-9A-Za-z_-])`);

/**
 * ファイル先頭のブロックコメントを取り出す。
 *
 * 「先頭 N 文字に `根拠:` と ID があること」を条件にすると、`const note = "根拠: ADR-0004"`
 * のような**コード中の文字列**でもガードを満たせてしまう。規約が要求しているのは
 * 「先頭コメントに根拠を書くこと」なので、判定対象を先頭コメントそのものに限定する。
 *
 * BOM・shebang・`"use client"` 等のディレクティブプロローグはコメントより前に置けるので、
 * それらを読み飛ばしてから最初のブロックコメントを取る。先頭コメントが無ければ根拠も無い。
 * 文字数で切らないので、長い先頭コメントの末尾に書かれた ID も正しく拾える。
 */
const LEADING_BLOCK_COMMENT = /^\uFEFF?(?:\s*#![^\n]*\n)?(?:\s*(['"])use [a-z-]+\1;?)*\s*(\/\*[\s\S]*?\*\/)/;

function leadingBlockComment(text: string): string {
  return LEADING_BLOCK_COMMENT.exec(text)?.[2] ?? "";
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * 走査対象のパッケージ src/ を実在するディレクトリから求める（所見 ADV-VER-005）。
 *
 * 固定配列で列挙すると、`pnpm-workspace.yaml` の `packages/*` に新しいパッケージを足したとき、
 * そのパッケージだけ規約の外に落ちる——しかも **CI は緑のまま**なので誰も気づかない。
 * 「全パッケージが対象」という主張を、列挙ではなく発見で満たす。
 */
function basisHeaderDirs(repoRoot: string): string[] {
  const packagesDir = join(repoRoot, "packages");
  let entries: string[];
  try {
    entries = readdirSync(packagesDir);
  } catch {
    return [];
  }
  return entries.map((entry) => join(packagesDir, entry, "src")).filter(isDirectory);
}

function basisHeaderFailures(repoRoot: string): string[] {
  return basisHeaderDirs(repoRoot)
    .flatMap((dir) => listFiles(dir, [".ts", ".tsx"]))
    .filter((file) => !BASIS_HEADER_ID.test(leadingBlockComment(readFileSync(file, "utf8"))))
    .map((file) => file.replace(`${repoRoot}/`, ""));
}

function adrReferenceFailures(repoRoot: string): string[] {
  const adrDir = join(repoRoot, "docs", "adr");
  const generatedOutputDir = resolve(repoRoot, "packages", "traceability", "output");
  const files = [
    ...listFiles(join(repoRoot, "packages"), [".ts", ".md"]),
    ...listFiles(join(repoRoot, "docs"), [".md"]),
  ].filter((file) => !resolve(file).startsWith(`${generatedOutputDir}${sep}`));
  const refs = new Set<string>();
  for (const file of files) {
    for (const match of readFileSync(file, "utf8").matchAll(/ADR-(\d{4})/g)) refs.add(match[1]!);
  }
  return [...refs]
    .sort()
    .filter((id) => !readdirSync(adrDir).some((entry) => entry.startsWith(`${id}-`) && entry.endsWith(".md")))
    .map((id) => `ADR-${id}`);
}

export interface TraceabilityCliOptions {
  repoRoot?: string;
  writeOutput?: boolean;
  now?: Date;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
}

export interface TraceabilityRunResult {
  report: string;
  failures: string[];
  exitCode: 0 | 1;
  errorMessage?: string;
}

export async function runTraceability(options: TraceabilityCliOptions = {}): Promise<TraceabilityRunResult> {
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const specIdsDir = join(repoRoot, "packages", "traceability", "spec-ids");
  const prjopsIndex = loadSpecIndex(join(specIdsDir, "prjops.json"));
  const devopsIndex = loadSpecIndex(join(specIdsDir, "devops.json"));
  const prjopsIds = indexedIds(prjopsIndex);
  const devopsIds = indexedIds(devopsIndex);
  const knownBySystem = new Map<string, ReadonlySet<string>>([
    [prjopsIndex.system, prjopsIds],
    [devopsIndex.system, devopsIds],
  ]);
  const collidingIds = new Set([...prjopsIds].filter((id) => devopsIds.has(id)));

  const sharedDir = join(repoRoot, "packages", "shared");
  const traceabilityDir = join(repoRoot, "packages", "traceability");
  const prjopsDir = join(repoRoot, "packages", "prjops");
  const devopsDir = join(repoRoot, "packages", "devops");
  const serverDir = join(repoRoot, "packages", "server");
  const webDir = join(repoRoot, "packages", "web");
  const packageDirs = [sharedDir, traceabilityDir, prjopsDir, devopsDir, serverDir, webDir];

  const prjopsCorpus = buildCorpus([sharedDir, traceabilityDir, prjopsDir, serverDir, webDir]);
  const devopsCorpus = buildCorpus([sharedDir, traceabilityDir, devopsDir, serverDir, webDir]);
  const prjopsReferences = {
    src: parseReferences(prjopsCorpus.srcText, knownBySystem, collidingIds),
    test: parseReferences(prjopsCorpus.testText, knownBySystem, collidingIds),
  };
  const devopsReferences = {
    src: parseReferences(devopsCorpus.srcText, knownBySystem, collidingIds),
    test: parseReferences(devopsCorpus.testText, knownBySystem, collidingIds),
  };
  const namespaceFailures = namespaceFailuresByFile(
    repoRoot,
    packageDirs,
    knownBySystem,
    collidingIds,
    new Set([join(traceabilityDir, "tests", "verifyTraceability.test.ts")]),
  );
  const indexGuardFailures = specIndexFailures([prjopsIndex, devopsIndex]);
  const catalogGuardFailures = catalogFailures(repoRoot, [prjopsIndex, devopsIndex]);
  // 報告と失敗収集で同じ結果を使う。片方だけに現れると、失敗した実行の成果物が
  // 全ガード clean に見えてしまう。
  const configGuardFailures = configInventoryFailures(repoRoot);

  const prjopsResults: CategoryResult[] = [
    checkCategory(prjopsIndex.REQ, "REQ", prjopsIndex.system, prjopsReferences, collidingIds),
    checkCategory(prjopsIndex["SPEC-EXT"], "SPEC-EXT", prjopsIndex.system, prjopsReferences, collidingIds),
    checkCategory(prjopsIndex["SPEC-INT"], "SPEC-INT", prjopsIndex.system, prjopsReferences, collidingIds),
    checkCategory(prjopsIndex.AC, "AC", prjopsIndex.system, prjopsReferences, collidingIds),
    checkCategory(prjopsIndex.ISS, "ISS(参考)", prjopsIndex.system, prjopsReferences, collidingIds),
    checkCategory(prjopsIndex.TOBE, "TOBE(参考)", prjopsIndex.system, prjopsReferences, collidingIds),
    checkCategory(prjopsIndex.ASM, "ASM(参考)", prjopsIndex.system, prjopsReferences, collidingIds),
  ];

  const devopsResults: CategoryResult[] = [
    checkCategory(devopsIndex.REQ, "REQ", devopsIndex.system, devopsReferences, collidingIds),
    checkCategory(devopsIndex["SPEC-EXT"], "SPEC-EXT", devopsIndex.system, devopsReferences, collidingIds),
    checkCategory(devopsIndex["SPEC-INT"], "SPEC-INT", devopsIndex.system, devopsReferences, collidingIds),
    checkCategory(devopsIndex.TH, "TH", devopsIndex.system, devopsReferences, collidingIds),
    checkCategory(devopsIndex.AC, "AC", devopsIndex.system, devopsReferences, collidingIds),
    checkCategory(devopsIndex.ISS, "ISS(参考)", devopsIndex.system, devopsReferences, collidingIds),
  ];

  const report = await formatMarkdown(
    [
      "# トレーサビリティ検証結果",
      "",
      `生成日時: ${(options.now ?? new Date()).toISOString()}`,
      "",
      "凡例: 「source参照あり」= `packages/*/src` 配下のコード（コメント含む）にIDが1回以上出現。",
      "「テスト参照あり」= `packages/*/tests` 配下のテストコードにIDが1回以上出現。",
      "注記: 参照の存在は構文上の接続だけを示し、要件の振る舞いを検証した証明ではありません。",
      "ISS/TOBE/ASMは文書間トレーサビリティの記録用IDであり、実装コードへの直接参照を必須としない（参考値）。",
      "",
      formatResults("PrjOps", prjopsResults),
      "",
      formatResults("DevOps", devopsResults),
      "",
      formatDispositions([prjopsIndex, devopsIndex]),
      "",
      "## Traceability Guards",
      "",
      `- 根拠ヘッダ不足: ${basisHeaderFailures(repoRoot).join(", ") || "—"}`,
      `- 存在しないADR参照: ${adrReferenceFailures(repoRoot).join(", ") || "—"}`,
      `- 名前空間参照不正: ${namespaceFailures.join(", ") || "—"}`,
      `- 仕様IDインデックス不正: ${indexGuardFailures.join(", ") || "—"}`,
      `- disposition不正: ${
        [...dispositionFailures(repoRoot, prjopsIndex), ...dispositionFailures(repoRoot, devopsIndex)].join(", ") || "—"
      }`,
      `- 仕様IDカタログ不正: ${catalogGuardFailures.join(", ") || "—"}`,
      `- 設定変数インベントリ不整合: ${configGuardFailures.join(", ") || "—"}`,
      "",
    ].join("\n"),
    { parser: "markdown" },
  );

  if (options.writeOutput !== false) {
    const outDir = join(repoRoot, "packages", "traceability", "output");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "traceability_matrix.md"), report, "utf8");
  }

  const failures = collectFailureMessages(
    [...prjopsResults, ...devopsResults],
    basisHeaderFailures(repoRoot),
    adrReferenceFailures(repoRoot),
    namespaceFailures,
    [...dispositionFailures(repoRoot, prjopsIndex), ...dispositionFailures(repoRoot, devopsIndex)],
    [...indexGuardFailures, ...catalogGuardFailures, ...configGuardFailures],
  );
  const errorMessage =
    failures.length > 0 ? `E-TRACE01: トレーサビリティ検証に失敗しました: ${failures.join(", ")}` : undefined;
  return { report, failures, exitCode: errorMessage ? 1 : 0, errorMessage };
}

export async function runTraceabilityCli(options: TraceabilityCliOptions = {}): Promise<number> {
  const result = await runTraceability(options);
  (options.stdout ?? console.log)(result.report);
  if (result.errorMessage) (options.stderr ?? console.error)(`\n${result.errorMessage}`);
  else
    (options.stdout ?? console.log)(
      "\nOK: 仕様IDカタログが完全で、全REQ/SPEC-INT/TH IDが実装コードから最低1回参照されています。",
    );
  return result.exitCode;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runTraceabilityCli();
}
