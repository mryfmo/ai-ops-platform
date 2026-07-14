/**
 * 根拠: PrjOps:REQ-002, SPEC-INT-022
 */
import { constants } from "node:fs";
import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  YamlStakeholderMasterProvider,
  type StakeholderMasterFileHandle,
  type StakeholderMasterFileSystem,
} from "../src/data/yamlStakeholderMasterProvider.js";

const fixtureDirectory = fileURLToPath(new URL("./fixtures/stakeholders", import.meta.url));
const validYaml = await readFile(new URL("./fixtures/stakeholders/ST-010.yaml", import.meta.url), "utf8");

interface FakeEntry {
  content: string;
  isFile?: boolean;
}

function fakeFs(files: Record<string, string | FakeEntry>, entries = Object.keys(files)) {
  const close = vi.fn(async () => undefined);
  const open = vi.fn(async (path: string): Promise<StakeholderMasterFileHandle> => {
    const filename = path.split("/").at(-1)!;
    const configured = files[filename];
    if (configured === undefined) throw new Error(`ENOENT: ${filename}`);
    const entry: FakeEntry = typeof configured === "string" ? { content: configured } : configured;
    return {
      stat: vi.fn(async () => ({ isFile: () => entry.isFile !== false })),
      readFile: vi.fn(async () => entry.content),
      close,
    };
  });
  const fs: StakeholderMasterFileSystem = {
    realpath: vi.fn(async (path) => path),
    lstat: vi.fn(async () => ({ dev: 1, ino: 1, isDirectory: () => true })),
    readdir: vi.fn(async () => entries),
    open,
  };
  return { fs, open, close };
}

function yaml(id: string, email = "yamada@example.com", assignments = "  - project_id: PJ-001\n    profile: PRF-02") {
  return `id: ${id}
name: Test User
organization_id: ORG-001
assignments:
${assignments}
email: ${email}
teams_user_id: teams-${id}
preferred_language: ja
timezone: Asia/Tokyo
`;
}

describe("YamlStakeholderMasterProvider [PrjOps:REQ-002, PrjOps:SPEC-INT-010, PrjOps:SPEC-INT-022]", () => {
  it("fixtureからemailに一致する全プロファイルと可視範囲を解決する [PrjOps:REQ-002, SPEC-INT-022]", async () => {
    const provider = new YamlStakeholderMasterProvider(fixtureDirectory);

    await expect(provider.findByEmail("yamada@example.com")).resolves.toEqual([
      {
        stakeholderId: "ST-010",
        email: "yamada@example.com",
        profile: "PRF-02",
        managedProjectIds: [],
        assignedProjectIds: ["PJ-001"],
        participatingProjectIds: ["PJ-002"],
        investedProjectIds: [],
      },
      {
        stakeholderId: "ST-010",
        email: "yamada@example.com",
        profile: "PRF-01",
        managedProjectIds: [],
        assignedProjectIds: ["PJ-001"],
        participatingProjectIds: ["PJ-002"],
        investedProjectIds: [],
      },
    ]);
    await expect(provider.findByEmail("unknown@example.com")).resolves.toEqual([]);
  });

  it("同じhardened scanからTeams userとprojectのprofileを解決する [PrjOps:REQ-002, SPEC-INT-022]", async () => {
    const { fs } = fakeFs({ "ST-010.yaml": yaml("ST-010") });
    const provider = new YamlStakeholderMasterProvider("/data/stakeholders", fs);

    await expect(provider.findProfileByTeamsUserId("teams-ST-010", "PJ-001")).resolves.toBe("PRF-02");
    await expect(provider.findProfileByTeamsUserId("teams-ST-010", "PJ-999")).resolves.toBeNull();
    await expect(provider.findProfileByTeamsUserId(null, "PJ-001")).resolves.toBeNull();
  });

  it("ST-1000以降を読み、emailをtrim+casefoldして比較・出力する [PrjOps:REQ-002, SPEC-INT-022]", async () => {
    const { fs } = fakeFs({ "ST-1000.yaml": yaml("ST-1000", "  YAMADA@Example.COM  ") });
    const records = await new YamlStakeholderMasterProvider("/data/stakeholders", fs).findByEmail(
      " Yamada@example.COM ",
    );

    expect(records).toEqual([
      expect.objectContaining({ stakeholderId: "ST-1000", email: "yamada@example.com", profile: "PRF-02" }),
    ]);
  });

  it("PRF-01〜05を権限集約せず対応する可視範囲へ写像する [PrjOps:REQ-002, SPEC-INT-022]", async () => {
    const assignments = [
      ["PJ-001", "PRF-01"],
      ["PJ-002", "PRF-02"],
      ["PJ-003", "PRF-03"],
      ["PJ-004", "PRF-04"],
      ["PJ-005", "PRF-05"],
    ]
      .map(([project, profile]) => `  - project_id: ${project}\n    profile: ${profile}`)
      .join("\n");
    const { fs } = fakeFs({ "ST-1000.yaml": yaml("ST-1000", "roles@example.com", assignments) });
    const records = await new YamlStakeholderMasterProvider("/data/stakeholders", fs).findByEmail("roles@example.com");

    expect(records.map((record) => record.profile)).toEqual(["PRF-01", "PRF-02", "PRF-03", "PRF-04", "PRF-05"]);
    expect(records[0]).toMatchObject({
      participatingProjectIds: ["PJ-001"],
      assignedProjectIds: ["PJ-002"],
      managedProjectIds: ["PJ-003"],
      investedProjectIds: ["PJ-005"],
    });
  });

  it("無関係ファイルだけを無視し、stakeholderらしい不正yaml名はfail closedにする [PrjOps:REQ-002]", async () => {
    const unrelated = fakeFs({ "ST-010.yaml": validYaml }, ["README.md", "ORG-001.yaml", "ST-010.yml", "ST-010.yaml"]);
    await new YamlStakeholderMasterProvider("/data/stakeholders", unrelated.fs).findByEmail("yamada@example.com");
    expect(unrelated.open).toHaveBeenCalledTimes(1);

    const malformed = fakeFs({}, ["ST-abc.yaml"]);
    await expect(
      new YamlStakeholderMasterProvider("/data/stakeholders", malformed.fs).findByEmail("x@example.com"),
    ).rejects.toThrow(/invalid stakeholder filename.*ST-abc\.yaml/i);
    expect(malformed.open).not.toHaveBeenCalled();
  });

  it("open(O_RDONLY|O_NOFOLLOW)した同一handleをstat/read/closeしswapを参照しない [PrjOps:REQ-002]", async () => {
    let directoryTarget = validYaml;
    const captured = directoryTarget;
    const close = vi.fn(async () => undefined);
    const readFromHandle = vi.fn(async () => captured);
    const fs: StakeholderMasterFileSystem = {
      realpath: vi.fn(async (path) => path),
      lstat: vi.fn(async () => ({ dev: 1, ino: 1, isDirectory: () => true })),
      readdir: vi.fn(async () => ["ST-010.yaml"]),
      open: vi.fn(async (_path, flags) => {
        expect(flags).toBe(constants.O_RDONLY | constants.O_NOFOLLOW);
        directoryTarget = yaml("ST-999", "attacker@example.com");
        return {
          stat: vi.fn(async () => ({ isFile: () => true })),
          readFile: readFromHandle,
          close,
        };
      }),
    };

    await expect(
      new YamlStakeholderMasterProvider("/data/stakeholders", fs).findByEmail("yamada@example.com"),
    ).resolves.toHaveLength(2);
    expect(directoryTarget).toContain("ST-999");
    expect(readFromHandle).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it("nofollow open失敗、非通常file、invalid YAMLを拒否し、取得済handleは必ずcloseする [PrjOps:REQ-002]", async () => {
    const symlinkFs: StakeholderMasterFileSystem = {
      realpath: vi.fn(async (path) => path),
      lstat: vi.fn(async () => ({ dev: 1, ino: 1, isDirectory: () => true })),
      readdir: vi.fn(async () => ["ST-010.yaml"]),
      open: vi.fn(async () => {
        throw Object.assign(new Error("too many symbolic links"), { code: "ELOOP" });
      }),
    };
    await expect(
      new YamlStakeholderMasterProvider("/data/stakeholders", symlinkFs).findByEmail("x@example.com"),
    ).rejects.toThrow(/invalid stakeholder YAML.*ST-010\.yaml/i);

    const nonFile = fakeFs({ "ST-010.yaml": { content: validYaml, isFile: false } });
    await expect(
      new YamlStakeholderMasterProvider("/data/stakeholders", nonFile.fs).findByEmail("x@example.com"),
    ).rejects.toThrow(/invalid stakeholder YAML.*ST-010\.yaml/i);
    expect(nonFile.close).toHaveBeenCalledOnce();

    const invalid = fakeFs({ "ST-010.yaml": "id: [" });
    await expect(
      new YamlStakeholderMasterProvider("/data/stakeholders", invalid.fs).findByEmail("x@example.com"),
    ).rejects.toThrow(/invalid stakeholder YAML.*ST-010\.yaml/i);
    expect(invalid.close).toHaveBeenCalledOnce();
  });

  it("全fileをscanしnormalized emailが異なるST IDに重複したらfail closedにする [PrjOps:REQ-002]", async () => {
    const { fs, open } = fakeFs({
      "ST-010.yaml": yaml("ST-010", " User@Example.com "),
      "ST-011.yaml": yaml("ST-011", "user@example.COM"),
    });

    await expect(
      new YamlStakeholderMasterProvider("/data/stakeholders", fs).findByEmail("USER@example.com"),
    ).rejects.toThrow(/duplicate normalized stakeholder email.*user@example\.com.*ST-010.*ST-011/i);
    expect(open).toHaveBeenCalledTimes(2);
  });

  it("異なるST IDでteams_user_idが重複したら認可をfail closedにする [PrjOps:REQ-002]", async () => {
    const { fs } = fakeFs({
      "ST-010.yaml": yaml("ST-010"),
      "ST-011.yaml": yaml("ST-011", "other@example.com").replace("teams-ST-011", "teams-ST-010"),
    });

    await expect(
      new YamlStakeholderMasterProvider("/data/stakeholders", fs).findProfileByTeamsUserId("teams-ST-010", "PJ-001"),
    ).rejects.toThrow(/duplicate teams user id.*teams-ST-010.*ST-010.*ST-011/i);
  });

  it("Unicode正規等価なemailが異なるST IDに重複したらfail closedにする [PrjOps:REQ-002]", async () => {
    const { fs } = fakeFs({
      "ST-010.yaml": yaml("ST-010", "usér@example.com"),
      "ST-011.yaml": yaml("ST-011", "use\u0301r@example.com"),
    });

    await expect(
      new YamlStakeholderMasterProvider("/data/stakeholders", fs).findByEmail("usér@example.com"),
    ).rejects.toThrow(/duplicate normalized stakeholder email.*usér@example\.com.*ST-010.*ST-011/i);
  });

  it.each([
    ["stakeholder", "ST-010.yaml", yaml("STK-010")],
    ["organization", "ST-010.yaml", yaml("ST-010").replace("ORG-001", "ORG-X")],
    ["project", "ST-010.yaml", yaml("ST-010").replace("PJ-001", "PROJECT-001")],
    ["blank name", "ST-010.yaml", yaml("ST-010").replace("name: Test User", 'name: "   "')],
    ["invalid email", "ST-010.yaml", yaml("ST-010", "not-an-email")],
    ["whitespace stakeholder", "ST-010.yaml", yaml('" ST-010 "')],
    ["whitespace organization", "ST-010.yaml", yaml("ST-010").replace("ORG-001", '" ORG-001 "')],
    ["whitespace project", "ST-010.yaml", yaml("ST-010").replace("PJ-001", '" PJ-001 "')],
  ])("canonical ID/trimmed nonempty違反(%s)を拒否する [PrjOps:REQ-002]", async (_case, filename, content) => {
    const { fs } = fakeFs({ [filename]: content });
    await expect(
      new YamlStakeholderMasterProvider("/data/stakeholders", fs).findByEmail("yamada@example.com"),
    ).rejects.toThrow(/invalid stakeholder YAML/i);
  });

  it.each([
    [
      "exact duplicate",
      "  - project_id: PJ-001\n    profile: PRF-02\n  - project_id: PJ-001\n    profile: PRF-02",
      /duplicate stakeholder assignment/i,
    ],
    [
      "same-project conflicting profile",
      "  - project_id: PJ-001\n    profile: PRF-01\n  - project_id: PJ-001\n    profile: PRF-02",
      /conflicting stakeholder assignment/i,
    ],
  ])("assignment ambiguity(%s)をfail closedにする [PrjOps:REQ-002]", async (_case, assignments, message) => {
    const { fs } = fakeFs({ "ST-010.yaml": yaml("ST-010", "yamada@example.com", assignments) });
    await expect(
      new YamlStakeholderMasterProvider("/data/stakeholders", fs).findByEmail("yamada@example.com"),
    ).rejects.toThrow(message);
  });

  it("filename/id不一致を拒否する [PrjOps:REQ-002]", async () => {
    const { fs } = fakeFs({ "ST-010.yaml": yaml("ST-011") });
    await expect(
      new YamlStakeholderMasterProvider("/data/stakeholders", fs).findByEmail("yamada@example.com"),
    ).rejects.toThrow(/filename.*ST-010.*ST-011/i);
  });

  it.each(["data/stakeholders", "/data/../stakeholders"])(
    "relative/non-canonical configured directory(%s)をscan前に拒否する [PrjOps:REQ-002]",
    (directory) => {
      const { fs } = fakeFs({ "ST-010.yaml": validYaml });
      expect(() => new YamlStakeholderMasterProvider(directory, fs)).toThrow(/absolute canonical path/i);
    },
  );

  it("configured pathがdirectoryでなければ拒否する [PrjOps:REQ-002]", async () => {
    const { fs } = fakeFs({ "ST-010.yaml": validYaml });
    fs.lstat = vi.fn(async () => ({ dev: 1, ino: 1, isDirectory: () => false }));
    await expect(
      new YamlStakeholderMasterProvider("/data/stakeholders", fs).findByEmail("x@example.com"),
    ).rejects.toThrow(/not a directory/i);
  });

  it("実FSでconfigured directory symlinkをAからBへ差し替えても拒否する [PrjOps:REQ-002]", async () => {
    const root = await mkdtemp(join(await realpath(tmpdir()), "aiops-stakeholder-boundary-"));
    const first = join(root, "a");
    const second = join(root, "b");
    const current = join(root, "current");
    const replacement = join(root, "replacement");
    await mkdir(first);
    await mkdir(second);
    await writeFile(join(first, "ST-010.yaml"), validYaml);
    await writeFile(join(second, "ST-010.yaml"), yaml("ST-010", "attacker@example.com"));
    await symlink(first, current, "dir");

    let swapped = false;
    const fs: StakeholderMasterFileSystem = {
      realpath: async (path) => {
        const canonical = await realpath(path);
        if (!swapped) {
          await symlink(second, replacement, "dir");
          await rename(replacement, current);
          swapped = true;
        }
        return canonical;
      },
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

    try {
      await expect(new YamlStakeholderMasterProvider(current, fs).findByEmail("attacker@example.com")).rejects.toThrow(
        /canonical|symlink/i,
      );
      await expect(realpath(current)).resolves.toBe(second);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each([
    [2, 10],
    [1, 11],
  ])("scan中にnon-symlink directory identityが変わったら結果を破棄する (%s/%s) [PrjOps:REQ-002]", async (dev, ino) => {
    const fixture = fakeFs({ "ST-010.yaml": validYaml });
    fixture.fs.lstat = vi
      .fn()
      .mockResolvedValueOnce({ dev: 1, ino: 10, isDirectory: () => true })
      .mockResolvedValueOnce({ dev, ino, isDirectory: () => true });

    await expect(
      new YamlStakeholderMasterProvider("/data/stakeholders", fixture.fs).findByEmail("yamada@example.com"),
    ).rejects.toThrow(/directory changed during scan/i);
    expect(fixture.open).toHaveBeenCalledOnce();
    expect(fixture.close).toHaveBeenCalledOnce();
  });
});
