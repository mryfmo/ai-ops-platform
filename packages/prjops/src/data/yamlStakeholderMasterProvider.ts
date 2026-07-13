/**
 * packages/prjops/src/data/yamlStakeholderMasterProvider.ts
 *
 * 根拠: REQ-002, SPEC-INT-022（関係者マスタ）、AC-002-1（複数プロジェクト・複数立場）。
 */
import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { isValidId } from "@aiops/shared/ids.js";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { validateStakeholder } from "../lib/masterValidation.js";
import type { Profile } from "../lib/reportJobStateMachine.js";

export interface StakeholderRecord {
  stakeholderId: string;
  email: string;
  profile: Profile;
  managedProjectIds: string[];
  assignedProjectIds: string[];
  participatingProjectIds: string[];
  investedProjectIds: string[];
}

export interface StakeholderMasterProvider {
  findByEmail(email: string): Promise<StakeholderRecord[]>;
}

interface FileStat {
  isFile(): boolean;
}

export interface StakeholderMasterFileHandle {
  stat(): Promise<FileStat>;
  readFile(): Promise<string>;
  close(): Promise<void>;
}

export interface StakeholderMasterDirectoryStat {
  dev: number | bigint;
  ino: number | bigint;
  isDirectory(): boolean;
}

export interface StakeholderMasterFileSystem {
  realpath(path: string): Promise<string>;
  lstat(path: string): Promise<StakeholderMasterDirectoryStat>;
  readdir(directory: string): Promise<string[]>;
  open(path: string, flags: number): Promise<StakeholderMasterFileHandle>;
}

const nodeFileSystem: StakeholderMasterFileSystem = {
  realpath,
  lstat,
  readdir,
  open: async (path, flags) => {
    const handle = await open(path, flags);
    return {
      stat: () => handle.stat(),
      readFile: () => handle.readFile("utf8"),
      close: () => handle.close(),
    };
  },
};
const OPEN_FLAGS = constants.O_RDONLY | constants.O_NOFOLLOW;
const stakeholderLookingFilename = /^ST-.*\.yaml$/;
const profileSchema = z.enum(["PRF-01", "PRF-02", "PRF-03", "PRF-04", "PRF-05"]);
const canonicalId = (kind: "stakeholder" | "organization" | "project") =>
  z.string().refine((value) => isValidId(kind, value), `invalid ${kind} ID`);
const canonicalizeEmail = (value: string) => value.trim().normalize("NFC").toLowerCase();
const stakeholderSchema = z
  .object({
    id: canonicalId("stakeholder"),
    name: z.string().trim().min(1),
    organization_id: canonicalId("organization"),
    assignments: z.array(z.object({ project_id: canonicalId("project"), profile: profileSchema })),
    email: z.string().transform(canonicalizeEmail).pipe(z.string().min(1)),
    teams_user_id: z.string().trim().min(1).nullable().optional(),
    preferred_language: z.enum(["ja", "en"]),
    timezone: z.string().trim().min(1),
  })
  .passthrough();

/**
 * YAML関係者マスタを毎回読み直す、Webの既存Providerと構造互換な実装。
 * ファイル数・サイズ上限は正本値を推測せず、T-P0-10c のdeployment/load gateで定義・検証する。
 * production の directory と祖先は absolute canonical real path の immutable/non-symlink trust boundary とする。
 * scan前後の dev/ino 比較は通常の置換を検出するが、ABA置換や同一権限writerを完全には防げない。
 */
export class YamlStakeholderMasterProvider implements StakeholderMasterProvider {
  constructor(
    private readonly directory: string,
    private readonly fs: StakeholderMasterFileSystem = nodeFileSystem,
  ) {
    if (!isAbsolute(directory) || resolve(directory) !== directory) {
      throw new Error("Stakeholder directory must be an absolute canonical path");
    }
  }

  private async directoryIdentity(): Promise<{ dev: number | bigint; ino: number | bigint }> {
    if ((await this.fs.realpath(this.directory)) !== this.directory) {
      throw new Error("Stakeholder directory must be canonical and contain no symlinks");
    }
    const stat = await this.fs.lstat(this.directory);
    if (!stat.isDirectory()) throw new Error("Stakeholder directory is not a directory");
    return { dev: stat.dev, ino: stat.ino };
  }

  async findByEmail(email: string): Promise<StakeholderRecord[]> {
    const initialDirectory = await this.directoryIdentity();
    const requestedEmail = canonicalizeEmail(email);
    const stakeholders: Array<z.infer<typeof stakeholderSchema>> = [];
    const emailOwners = new Map<string, string>();

    for (const filename of (await this.fs.readdir(this.directory)).sort()) {
      if (!stakeholderLookingFilename.test(filename)) continue;
      const filenameId = filename.slice(0, -".yaml".length);
      if (!isValidId("stakeholder", filenameId)) throw new Error(`Invalid stakeholder filename: ${filename}`);
      const path = join(this.directory, filename);
      let input: z.infer<typeof stakeholderSchema>;
      let handle: StakeholderMasterFileHandle | undefined;
      try {
        handle = await this.fs.open(path, OPEN_FLAGS);
        if (!(await handle.stat()).isFile()) throw new Error(`Stakeholder entry is not a file: ${filename}`);
        input = stakeholderSchema.parse(parseYaml(await handle.readFile()));
      } catch (error) {
        throw new Error(`Invalid stakeholder YAML ${filename}`, { cause: error });
      } finally {
        await handle?.close();
      }

      if (input.id !== filenameId) {
        throw new Error(`Stakeholder filename ${filename} does not match id ${input.id}`);
      }
      const validation = validateStakeholder(input);
      if (!validation.ok) throw new Error(`Invalid stakeholder YAML ${filename}: ${validation.errors.join("; ")}`);

      const assignments = new Map<string, Profile>();
      for (const assignment of input.assignments) {
        const existing = assignments.get(assignment.project_id);
        if (existing === assignment.profile) {
          throw new Error(
            `Duplicate stakeholder assignment: ${input.id} ${assignment.project_id} ${assignment.profile}`,
          );
        }
        if (existing) {
          throw new Error(
            `Conflicting stakeholder assignment: ${input.id} ${assignment.project_id} ${existing}/${assignment.profile}`,
          );
        }
        assignments.set(assignment.project_id, assignment.profile);
      }

      const emailOwner = emailOwners.get(input.email);
      if (emailOwner && emailOwner !== input.id) {
        throw new Error(`Duplicate normalized stakeholder email: ${input.email} (${emailOwner}/${input.id})`);
      }
      emailOwners.set(input.email, input.id);
      stakeholders.push(input);
    }

    const finalDirectory = await this.directoryIdentity();
    if (initialDirectory.dev !== finalDirectory.dev || initialDirectory.ino !== finalDirectory.ino) {
      throw new Error("Stakeholder directory changed during scan");
    }

    const records: StakeholderRecord[] = [];
    for (const input of stakeholders) {
      if (input.email !== requestedEmail) continue;

      const projects = (profile: Profile) =>
        input.assignments
          .filter((assignment) => assignment.profile === profile)
          .map((assignment) => assignment.project_id);
      const visibility = {
        managedProjectIds: projects("PRF-03"),
        assignedProjectIds: projects("PRF-02"),
        participatingProjectIds: projects("PRF-01"),
        investedProjectIds: projects("PRF-05"),
      };
      for (const profile of new Set(input.assignments.map((assignment) => assignment.profile))) {
        records.push({ stakeholderId: input.id, email: input.email, profile, ...visibility });
      }
    }
    return records;
  }
}
