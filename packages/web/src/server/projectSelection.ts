/**
 * packages/web/src/server/projectSelection.ts
 *
 * 根拠: P010-F02-T10 / DEC-SPEC-008 / PrjOps:REQ-041 / DevOps:REQ-041。
 * URL の非信頼 project 値を canonical PJ-* として分類し、request-time scoped project 一覧へ照合する。
 */
import { isValidId } from "@aiops/shared";
import type { ResolvedPersona } from "./personaResolver";

export interface ProjectOption {
  id: string;
  name: string;
}

export type ParsedProjectSelection = { kind: "missing" } | { kind: "project"; projectId: string } | { kind: "all" };

export interface ResolvedProjectSelection {
  options: ProjectOption[];
  selected: string;
  autoSelected: boolean;
}

export class ProjectSelectionError extends Error {
  constructor(
    public readonly status: 400 | 403 | 409,
    message: string,
  ) {
    super(message);
    this.name = "ProjectSelectionError";
  }
}

export function parseProjectSelection(value: string | string[] | undefined): ParsedProjectSelection {
  if (value === undefined) return { kind: "missing" };
  if (typeof value !== "string") {
    throw new ProjectSelectionError(400, "E-AUTH06: malformed_project_selection");
  }
  if (value === "all") return { kind: "all" };
  if (!isValidId("project", value)) {
    throw new ProjectSelectionError(400, "E-AUTH06: malformed_project_selection");
  }
  return { kind: "project", projectId: value };
}

function asciiCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function canonicalProjectOptions(options: ProjectOption[]): ProjectOption[] {
  return options
    .filter((option) => isValidId("project", option.id))
    .sort((left, right) => asciiCompare(left.id, right.id) || asciiCompare(left.name, right.name));
}

export function portfolioAllowedForPersona(persona: ResolvedPersona): boolean {
  return (
    persona.scope.mode === "global" &&
    ((persona.domain === "prjops" && persona.profile === "PRF-04") ||
      (persona.domain === "devops" && persona.profile === "PRF-G"))
  );
}

export function resolveProjectSelection(
  value: string | string[] | undefined,
  availableProjects: ProjectOption[],
  portfolioAllowed: boolean,
): ResolvedProjectSelection {
  const parsed = parseProjectSelection(value);
  const options = canonicalProjectOptions(availableProjects);

  if (parsed.kind === "all") {
    if (!portfolioAllowed) throw new ProjectSelectionError(403, "E-AUTH07: project is not accessible");
    return { options, selected: "all", autoSelected: false };
  }
  if (parsed.kind === "project") {
    const project = options.find((option) => option.id === parsed.projectId);
    if (!project) throw new ProjectSelectionError(403, "E-AUTH07: project is not accessible");
    return { options, selected: project.id, autoSelected: false };
  }
  if (options.length === 1) {
    return { options, selected: options[0]!.id, autoSelected: true };
  }
  if (options.length === 0) {
    throw new ProjectSelectionError(403, "E-AUTH07: project is not accessible");
  }
  throw new ProjectSelectionError(409, "E-AUTH04: project_selection_required");
}
