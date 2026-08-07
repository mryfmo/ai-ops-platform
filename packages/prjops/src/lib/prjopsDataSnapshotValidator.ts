/**
 * packages/prjops/src/lib/prjopsDataSnapshotValidator.ts
 *
 * 根拠: PrjOps:SPEC-INT-010（prjops-data privateリポジトリが正本データ）/
 *   PrjOps:REQ-001（プロジェクトマスタ）/ PrjOps:REQ-002（関係者・企業マスタ）/
 *   PrjOps:REQ-033（正本リポジトリへの書込制御）/ P010-F02-T02 / DEC-SPEC-001
 *
 * prjops-data の取得済みentryを外部I/Oなしで検証する。
 * エラー優先順とcanonical manifest bytesは docs/contracts/prjops-data.md が正本。
 */
import { createHash } from "node:crypto";
import { TextDecoder } from "node:util";
import { isScalar, parseDocument, visit } from "yaml";
import { z } from "zod";

export const SNAPSHOT_ERROR_CODES = [
  "E-SNAPSHOT-SYMLINK",
  "E-SNAPSHOT-NONREGULAR",
  "E-SNAPSHOT-UNKNOWN-PATH",
  "E-SNAPSHOT-UTF8",
  "E-SNAPSHOT-BOM",
  "E-SNAPSHOT-NEWLINE",
  "E-SNAPSHOT-NFC",
  "E-SNAPSHOT-SCHEMA",
  "E-SNAPSHOT-UNKNOWN-FIELD",
  "E-SNAPSHOT-FILENAME-ID",
  "E-SNAPSHOT-DUPLICATE-ID",
  "E-SNAPSHOT-DUPLICATE-MAPPING",
  "E-SNAPSHOT-REFERENCE",
  "E-SNAPSHOT-OWNERSHIP",
  "E-SNAPSHOT-PARTIAL",
  "E-SNAPSHOT-CHECKSUM",
] as const;

export type SnapshotErrorCode = (typeof SNAPSHOT_ERROR_CODES)[number];

export interface SnapshotEntry {
  path: string;
  kind: string;
  bytes: Uint8Array;
}

export type SnapshotFailure = { ok: false; code: SnapshotErrorCode };

export type SnapshotManifestResult =
  | SnapshotFailure
  | {
      ok: true;
      manifestBytes: Uint8Array;
      contentSha256: string;
    };

export type SnapshotValidationResult =
  | SnapshotFailure
  | {
      ok: true;
      manifestBytes: Uint8Array;
      contentSha256: string;
      documents: ValidatedSnapshotDocument[];
    };

const id = {
  organization: z.string().regex(/^ORG-[0-9]+$/),
  project: z.string().regex(/^PJ-[0-9]+$/),
  stakeholder: z.string().regex(/^ST-[0-9]+$/),
  issue: z.string().regex(/^ISSUE-[0-9]+$/),
  action: z.string().regex(/^ACT-[0-9]+$/),
};
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
const date = z.string().date();
const dateTime = z.string().datetime({ offset: true });
const month = z.string().regex(/^[0-9]{4}-(0[1-9]|1[0-2])$/);
const nullableNumber = z.number().nullable();
const rag = z.enum(["green", "yellow", "red", "grey"]);

function uniqueArray<T extends z.ZodType>(item: T): z.ZodArray<T> {
  return z.array(item).refine((values) => new Set(values.map((value) => JSON.stringify(value))).size === values.length);
}

const lifecycle = {
  active: z.boolean(),
  created_at: dateTime,
  updated_at: dateTime,
  updated_by: id.stakeholder,
  deactivated_at: dateTime.nullable(),
  deactivation_reason: z.string().min(1).nullable(),
};

function lifecycleSchema<T extends z.ZodRawShape>(shape: T) {
  return z
    .object({ ...shape, ...lifecycle })
    .strict()
    .superRefine((value, context) => {
      const record = value as Record<string, unknown>;
      const valid = record.active
        ? record.deactivated_at === null && record.deactivation_reason === null
        : record.deactivated_at !== null && record.deactivation_reason !== null;
      if (!valid) context.addIssue({ code: "custom", message: "invalid lifecycle disposition" });
    });
}

const assignmentSchema = z
  .object({
    domain: z.enum(["prjops", "devops"]),
    profile: z.enum(["PRF-01", "PRF-M", "PRF-02", "PRF-L", "PRF-03", "PRF-G", "PRF-04", "PRF-05", "investor"]),
    scope_mode: z.enum(["project", "global"]),
    project_id: id.project.nullable(),
    active: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.scope_mode === "project") !== (value.project_id !== null)) {
      context.addIssue({ code: "custom", message: "scope and project mismatch" });
    }
    if (value.scope_mode === "global" && value.profile !== "PRF-04" && value.profile !== "PRF-G") {
      context.addIssue({ code: "custom", message: "profile cannot be global" });
    }
    const prjopsProfiles = new Set(["PRF-01", "PRF-02", "PRF-03", "PRF-04", "PRF-05", "investor"]);
    if ((value.domain === "prjops") !== prjopsProfiles.has(value.profile)) {
      context.addIssue({ code: "custom", message: "domain and profile mismatch" });
    }
  });

const organizationSchema = lifecycleSchema({
  id: id.organization,
  name: z.string().min(1),
  country: z.string().regex(/^[A-Z]{2}$/),
  domestic_or_overseas: z.enum(["domestic", "overseas"]),
});

const projectSchema = lifecycleSchema({
  id: id.project,
  name: z.string().min(1),
  leader_id: id.stakeholder,
  manager_id: id.stakeholder,
  organization_ids: uniqueArray(id.organization).min(1),
  start_date: date,
  end_date: date,
  report_frequency: z.literal("weekly"),
  status: z.enum(["active", "suspended", "closed"]),
});

const stakeholderSchema = lifecycleSchema({
  id: id.stakeholder,
  name: z.string().min(1),
  organization_id: id.organization,
  entra_tenant_id: uuid,
  entra_object_id: uuid,
  assignments: z.array(assignmentSchema).min(1),
  invested_project_ids: uniqueArray(id.project),
  email: z.string().email(),
  teams_user_id: z.string().min(1).nullable(),
  preferred_language: z.enum(["ja", "en"]),
  timezone: z.string().min(1),
});

const issueSchema = lifecycleSchema({
  id: id.issue,
  project_id: id.project,
  title: z.string().min(1),
  detail: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  severity_proposed: z.enum(["low", "medium", "high", "critical"]).nullable(),
  status: z.enum(["open", "closed"]),
  closed_by: id.stakeholder.nullable(),
  closed_reason: z.string().min(1).nullable(),
});

const actionSchema = lifecycleSchema({
  id: id.action,
  project_id: id.project,
  title: z.string().min(1),
  assignee: id.stakeholder,
  due: date,
  status: z.enum(["open", "done", "cancelled"]),
  reminders_sent: uniqueArray(dateTime),
});

const referenceList = uniqueArray(
  z
    .object({
      ref: z.string().regex(/^[A-Z]+-[A-Za-z0-9-]+$/),
    })
    .strict(),
);

const statusUpdateSchema = lifecycleSchema({
  id: z.string().regex(/^SU-[A-Za-z0-9-]+$/),
  project_id: id.project,
  period: z.object({ start: date, end: date }).strict(),
  channel: z.enum(["email", "teams", "web"]),
  reporter: id.stakeholder,
  progress_pct: z.number().min(0).max(100),
  self_status: rag,
  achievements: z.string(),
  plans: z.string(),
  issues: referenceList,
  risks: referenceList,
  complete: z.boolean(),
  raw_source: z.string().min(1),
});

const transitionState = z.enum(["generated", "verified", "pending_approval", "approved", "delivered", "failed"]);
const reportJobSchema = lifecycleSchema({
  id: z.string().regex(/^RPT-[A-Za-z0-9-]+$/),
  profile: z.enum(["PRF-01", "PRF-02", "PRF-03", "PRF-04", "PRF-05"]),
  scope: id.project,
  period: z.string().min(1),
  recipient: id.stakeholder,
  status: transitionState,
  transitions: z.array(z.object({ state: transitionState, at: dateTime }).strict()).min(1),
  delivery_log_ref: z.string().min(1),
});

const sevenKeysQuestionnaireSchema = lifecycleSchema({
  id: z.string().regex(/^SKQ-[A-Za-z0-9-]+$/),
  project_id: id.project,
  month,
  answers: z
    .object({
      stakeholders_committed: rag,
      business_benefits: rag,
      risk_mitigation: rag,
      delivery_org_benefits: rag,
    })
    .strict(),
});

const sevenKeyId = z.enum(["K1", "K2", "K3", "K4", "K5", "K6", "K7"]);
const sevenKeysSnapshotSchema = z
  .object({
    id: z.string().regex(/^SKS-[A-Za-z0-9-]+$/),
    project_id: id.project,
    month,
    name: z.string().min(1),
    keys: z.array(z.object({ key_id: sevenKeyId, rag, basis: z.string().min(1) }).strict()).length(7),
    improved_keys: uniqueArray(sevenKeyId),
    worsened_keys: uniqueArray(sevenKeyId),
    trace_id: z.string().min(1),
    created_at: dateTime,
  })
  .strict();

const financialProjectSchema = z
  .object({
    project_id: id.project,
    ownership_pct: z.number(),
    revenue: nullableNumber,
    ebitda: nullableNumber,
  })
  .strict();
const financialInputsSchema = z
  .object({
    currency: z.string().regex(/^[A-Z]{3}$/),
    as_of: date,
    projects: z.array(financialProjectSchema),
    updated_at: dateTime,
    updated_by: id.stakeholder,
  })
  .strict();
const boardPackSchema = z
  .object({
    targets: z.object({ revenue: nullableNumber, ebitda: nullableNumber }).strict(),
    history: z.array(
      z
        .object({
          as_of: date,
          companies: z.array(financialProjectSchema),
        })
        .strict(),
    ),
    updated_at: dateTime,
    updated_by: id.stakeholder,
  })
  .strict();
const versionSchema = z
  .object({
    schema_version: z.literal("1.0.0"),
    generated_at: dateTime,
    content_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();

export type SnapshotDocumentKind =
  | "version"
  | "organization"
  | "project"
  | "stakeholder"
  | "issue"
  | "action"
  | "statusUpdate"
  | "reportJob"
  | "questionnaire"
  | "sevenKeysSnapshot"
  | "financialInputs"
  | "boardPack";

interface PathDescriptor {
  kind: SnapshotDocumentKind;
  pattern: RegExp;
  schema: z.ZodType;
  hasFilenameId: boolean;
}

const pathDescriptors: PathDescriptor[] = [
  { kind: "version", pattern: /^schema\/version\.yaml$/, schema: versionSchema, hasFilenameId: false },
  {
    kind: "organization",
    pattern: /^organizations\/ORG-[0-9]+\.yaml$/,
    schema: organizationSchema,
    hasFilenameId: true,
  },
  { kind: "project", pattern: /^projects\/PJ-[0-9]+\.yaml$/, schema: projectSchema, hasFilenameId: true },
  {
    kind: "stakeholder",
    pattern: /^stakeholders\/ST-[0-9]+\.yaml$/,
    schema: stakeholderSchema,
    hasFilenameId: true,
  },
  { kind: "issue", pattern: /^issues\/ISSUE-[0-9]+\.yaml$/, schema: issueSchema, hasFilenameId: true },
  { kind: "action", pattern: /^actions\/ACT-[0-9]+\.yaml$/, schema: actionSchema, hasFilenameId: true },
  {
    kind: "statusUpdate",
    pattern: /^status_updates\/SU-[A-Za-z0-9-]+\.yaml$/,
    schema: statusUpdateSchema,
    hasFilenameId: true,
  },
  {
    kind: "reportJob",
    pattern: /^report_jobs\/RPT-[A-Za-z0-9-]+\.yaml$/,
    schema: reportJobSchema,
    hasFilenameId: true,
  },
  {
    kind: "questionnaire",
    pattern: /^seven_keys\/questionnaires\/SKQ-[A-Za-z0-9-]+\.yaml$/,
    schema: sevenKeysQuestionnaireSchema,
    hasFilenameId: true,
  },
  {
    kind: "sevenKeysSnapshot",
    pattern: /^seven_keys\/snapshots\/SKS-[A-Za-z0-9-]+\.yaml$/,
    schema: sevenKeysSnapshotSchema,
    hasFilenameId: true,
  },
  {
    kind: "financialInputs",
    pattern: /^investor\/financial_inputs\.yaml$/,
    schema: financialInputsSchema,
    hasFilenameId: false,
  },
  {
    kind: "boardPack",
    pattern: /^investor\/board_pack\.yaml$/,
    schema: boardPackSchema,
    hasFilenameId: false,
  },
];

interface CanonicalizedEntries {
  texts: string[];
  manifestBytes: Uint8Array;
  contentSha256: string;
}

export interface ValidatedSnapshotDocument {
  path: string;
  kind: SnapshotDocumentKind;
  document: Record<string, unknown>;
}

interface ParsedEntry extends ValidatedSnapshotDocument {
  descriptor: PathDescriptor;
}

function failure(code: SnapshotErrorCode): SnapshotFailure {
  return { ok: false, code };
}

function descriptorFor(path: string): PathDescriptor | undefined {
  return pathDescriptors.find((descriptor) => descriptor.pattern.test(path));
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalize(entries: readonly SnapshotEntry[]): SnapshotFailure | CanonicalizedEntries {
  if (entries.some((entry) => entry.kind === "symlink")) return failure("E-SNAPSHOT-SYMLINK");
  if (entries.some((entry) => entry.kind !== "regular")) return failure("E-SNAPSHOT-NONREGULAR");
  if (entries.some((entry) => descriptorFor(entry.path) === undefined)) return failure("E-SNAPSHOT-UNKNOWN-PATH");

  const texts: string[] = [];
  for (const entry of entries) {
    try {
      texts.push(new TextDecoder("utf-8", { fatal: true }).decode(entry.bytes));
    } catch {
      return failure("E-SNAPSHOT-UTF8");
    }
  }
  if (entries.some((entry) => entry.bytes[0] === 0xef && entry.bytes[1] === 0xbb && entry.bytes[2] === 0xbf)) {
    return failure("E-SNAPSHOT-BOM");
  }
  if (
    entries.some(
      (entry) =>
        entry.bytes.includes(0x0d) ||
        (entry.bytes.length > 0 &&
          (entry.bytes.at(-1) !== 0x0a || (entry.bytes.length > 1 && entry.bytes.at(-2) === 0x0a))),
    )
  ) {
    return failure("E-SNAPSHOT-NEWLINE");
  }
  if (texts.some((text) => text !== text.normalize("NFC"))) return failure("E-SNAPSHOT-NFC");

  const files = entries
    .filter((entry) => entry.path !== "schema/version.yaml")
    .map((entry) => ({ path: entry.path, sha256: sha256(entry.bytes), size: entry.bytes.byteLength }))
    .sort((left, right) => Buffer.compare(Buffer.from(left.path, "ascii"), Buffer.from(right.path, "ascii")));
  const manifestBytes = Buffer.from(
    `{"files":[${files
      .map((file) => `{"path":"${file.path}","sha256":"${file.sha256}","size":${file.size}}`)
      .join(",")}]}\n`,
  );
  return { texts, manifestBytes, contentSha256: sha256(manifestBytes) };
}

export function buildPrjopsDataManifest(entries: readonly SnapshotEntry[]): SnapshotManifestResult {
  const result = canonicalize(entries);
  return "code" in result
    ? result
    : { ok: true, manifestBytes: result.manifestBytes, contentSha256: result.contentSha256 };
}

function parseYaml(text: string): { ok: true; value: unknown } | SnapshotFailure {
  const document = parseDocument(text, { strict: true, uniqueKeys: true, merge: false });
  if (document.errors.length > 0 || document.warnings.length > 0) return failure("E-SNAPSHOT-SCHEMA");

  let forbidden = false;
  visit(document, {
    Alias() {
      forbidden = true;
    },
    Pair(_key, pair) {
      if (isScalar(pair.key) && pair.key.value === "<<") forbidden = true;
    },
  });
  if (forbidden) return failure("E-SNAPSHOT-SCHEMA");

  try {
    return { ok: true, value: document.toJS({ maxAliasCount: 0 }) };
  } catch {
    return failure("E-SNAPSHOT-SCHEMA");
  }
}

function parseAndValidate(
  entries: readonly SnapshotEntry[],
  texts: readonly string[],
): SnapshotFailure | ParsedEntry[] {
  const parsed: ParsedEntry[] = [];
  let hasUnknownField = false;

  for (const [index, entry] of entries.entries()) {
    const yaml = parseYaml(texts[index]!);
    if (!yaml.ok) return yaml;
    const descriptor = descriptorFor(entry.path)!;
    const validation = descriptor.schema.safeParse(yaml.value);
    if (!validation.success) {
      if (validation.error.issues.some((issue) => issue.code !== "unrecognized_keys")) {
        return failure("E-SNAPSHOT-SCHEMA");
      }
      hasUnknownField = true;
      continue;
    }
    parsed.push({
      path: entry.path,
      kind: descriptor.kind,
      descriptor,
      document: validation.data as Record<string, unknown>,
    });
  }
  return hasUnknownField ? failure("E-SNAPSHOT-UNKNOWN-FIELD") : parsed;
}

function filenameId(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1, -".yaml".length);
}

function validateFilenameIds(entries: readonly ParsedEntry[]): SnapshotFailure | undefined {
  for (const entry of entries) {
    if (entry.descriptor.hasFilenameId && entry.document.id !== filenameId(entry.path)) {
      return failure("E-SNAPSHOT-FILENAME-ID");
    }
  }
}

function validateDuplicateIds(entries: readonly ParsedEntry[]): SnapshotFailure | undefined {
  const paths = new Set<string>();
  const ids = new Set<string>();
  const questionnaireKeys = new Set<string>();
  const snapshotKeys = new Set<string>();

  for (const entry of entries) {
    if (paths.has(entry.path)) return failure("E-SNAPSHOT-DUPLICATE-ID");
    paths.add(entry.path);
    if (typeof entry.document.id === "string") {
      if (ids.has(entry.document.id)) return failure("E-SNAPSHOT-DUPLICATE-ID");
      ids.add(entry.document.id);
    }
    if (entry.descriptor.kind === "questionnaire" || entry.descriptor.kind === "sevenKeysSnapshot") {
      const key = `${entry.document.project_id as string}\0${entry.document.month as string}`;
      const keys = entry.descriptor.kind === "questionnaire" ? questionnaireKeys : snapshotKeys;
      if (keys.has(key)) return failure("E-SNAPSHOT-DUPLICATE-ID");
      keys.add(key);
    }
    const groups =
      entry.descriptor.kind === "financialInputs"
        ? [(entry.document.projects as Array<Record<string, unknown>>).map((project) => project.project_id as string)]
        : entry.descriptor.kind === "boardPack"
          ? (entry.document.history as Array<Record<string, unknown>>).map((history) =>
              (history.companies as Array<Record<string, unknown>>).map((company) => company.project_id as string),
            )
          : [];
    if (groups.some((group) => new Set(group).size !== group.length)) return failure("E-SNAPSHOT-DUPLICATE-ID");
  }
}

function validateDuplicateMappings(entries: readonly ParsedEntry[]): SnapshotFailure | undefined {
  const subjects = new Set<string>();
  const emails = new Set<string>();
  const teamsIds = new Set<string>();
  for (const entry of entries) {
    if (entry.descriptor.kind !== "stakeholder") continue;
    const document = entry.document;
    for (const [set, value] of [
      [subjects, `${document.entra_tenant_id as string}\0${document.entra_object_id as string}`],
      [emails, (document.email as string).toLowerCase()],
      [teamsIds, document.teams_user_id as string | null],
    ] as const) {
      if (value === null) continue;
      if (set.has(value)) return failure("E-SNAPSHOT-DUPLICATE-MAPPING");
      set.add(value);
    }
    const assignments = (document.assignments as Array<Record<string, unknown>>).map((assignment) =>
      ["domain", "profile", "scope_mode", "project_id"].map((key) => assignment[key] ?? "").join("\0"),
    );
    if (new Set(assignments).size !== assignments.length) return failure("E-SNAPSHOT-DUPLICATE-MAPPING");
  }
}

function referencesResolve(entries: readonly ParsedEntry[]): boolean {
  const byKind = (kind: SnapshotDocumentKind) =>
    new Set(
      entries
        .filter((entry) => entry.descriptor.kind === kind)
        .map((entry) => entry.document.id)
        .filter((value): value is string => typeof value === "string"),
    );
  const organizations = byKind("organization");
  const projects = byKind("project");
  const stakeholders = byKind("stakeholder");
  const allIds = new Set(
    entries.map((entry) => entry.document.id).filter((value): value is string => typeof value === "string"),
  );
  const hasAll = (set: ReadonlySet<string>, values: readonly unknown[]) =>
    values.every((value) => typeof value === "string" && set.has(value));

  for (const entry of entries) {
    const document = entry.document;
    if (
      [
        "organization",
        "project",
        "stakeholder",
        "issue",
        "action",
        "statusUpdate",
        "reportJob",
        "questionnaire",
      ].includes(entry.descriptor.kind) &&
      !stakeholders.has(document.updated_by as string)
    ) {
      return false;
    }
    switch (entry.descriptor.kind) {
      case "project":
        if (
          !hasAll(stakeholders, [document.leader_id, document.manager_id]) ||
          !hasAll(organizations, document.organization_ids as unknown[])
        )
          return false;
        break;
      case "stakeholder":
        if (!organizations.has(document.organization_id as string)) return false;
        if (
          !hasAll(
            projects,
            (document.assignments as Array<Record<string, unknown>>)
              .filter((assignment) => assignment.scope_mode === "project")
              .map((assignment) => assignment.project_id),
          ) ||
          !hasAll(projects, document.invested_project_ids as unknown[])
        )
          return false;
        break;
      case "issue":
        if (
          !projects.has(document.project_id as string) ||
          (document.closed_by !== null && !stakeholders.has(document.closed_by as string))
        )
          return false;
        break;
      case "action":
        if (!projects.has(document.project_id as string) || !stakeholders.has(document.assignee as string))
          return false;
        break;
      case "statusUpdate":
        if (
          !projects.has(document.project_id as string) ||
          !stakeholders.has(document.reporter as string) ||
          !hasAll(
            allIds,
            [...(document.issues as Array<{ ref: string }>), ...(document.risks as Array<{ ref: string }>)].map(
              (reference) => reference.ref,
            ),
          )
        )
          return false;
        break;
      case "reportJob":
        if (!projects.has(document.scope as string) || !stakeholders.has(document.recipient as string)) return false;
        break;
      case "questionnaire":
      case "sevenKeysSnapshot":
        if (!projects.has(document.project_id as string)) return false;
        break;
      case "financialInputs":
        if (
          !stakeholders.has(document.updated_by as string) ||
          !hasAll(
            projects,
            (document.projects as Array<Record<string, unknown>>).map((project) => project.project_id),
          )
        )
          return false;
        break;
      case "boardPack":
        if (
          !stakeholders.has(document.updated_by as string) ||
          !(document.history as Array<Record<string, unknown>>).every((history) =>
            hasAll(
              projects,
              (history.companies as Array<Record<string, unknown>>).map((company) => company.project_id),
            ),
          )
        )
          return false;
        break;
      default:
        break;
    }
  }
  return true;
}

function validateOwnership(entries: readonly ParsedEntry[]): SnapshotFailure | undefined {
  const percentages: number[] = [];
  for (const entry of entries) {
    if (entry.descriptor.kind === "financialInputs") {
      percentages.push(
        ...(entry.document.projects as Array<Record<string, unknown>>).map(
          (project) => project.ownership_pct as number,
        ),
      );
    }
    if (entry.descriptor.kind === "boardPack") {
      for (const history of entry.document.history as Array<Record<string, unknown>>) {
        percentages.push(
          ...(history.companies as Array<Record<string, unknown>>).map((company) => company.ownership_pct as number),
        );
      }
    }
  }
  if (percentages.some((percentage) => percentage < 0 || percentage > 100)) {
    return failure("E-SNAPSHOT-OWNERSHIP");
  }
}

function validateRequiredSingletons(entries: readonly ParsedEntry[]): SnapshotFailure | undefined {
  const paths = new Set(entries.map((entry) => entry.path));
  if (
    !["schema/version.yaml", "investor/financial_inputs.yaml", "investor/board_pack.yaml"].every((path) =>
      paths.has(path),
    )
  ) {
    return failure("E-SNAPSHOT-PARTIAL");
  }
}

export function validatePrjopsDataSnapshot(entries: readonly SnapshotEntry[]): SnapshotValidationResult {
  const canonical = canonicalize(entries);
  if ("code" in canonical) return canonical;

  const parsed = parseAndValidate(entries, canonical.texts);
  if ("code" in parsed) return parsed;
  for (const validation of [
    validateFilenameIds(parsed),
    validateDuplicateIds(parsed),
    validateDuplicateMappings(parsed),
    referencesResolve(parsed) ? undefined : failure("E-SNAPSHOT-REFERENCE"),
    validateOwnership(parsed),
    validateRequiredSingletons(parsed),
  ]) {
    if (validation) return validation;
  }

  const version = parsed.find((entry) => entry.descriptor.kind === "version")?.document;
  if (version?.content_sha256 !== canonical.contentSha256) return failure("E-SNAPSHOT-CHECKSUM");
  return {
    ok: true,
    manifestBytes: canonical.manifestBytes,
    contentSha256: canonical.contentSha256,
    documents: parsed.map(({ path, descriptor, document }) => ({ path, kind: descriptor.kind, document })),
  };
}
