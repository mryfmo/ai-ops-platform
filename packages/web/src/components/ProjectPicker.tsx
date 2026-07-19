/**
 * packages/web/src/components/ProjectPicker.tsx
 *
 * 根拠: P010-F02-T10 / DEC-SPEC-008 / PrjOps:REQ-041 / DevOps:REQ-041。
 * scoped project options だけを native select で表示し、選択を canonical URL state へ反映する。
 */
"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ProjectOption } from "../server/projectSelection";

export interface ProjectPickerProps {
  projects: ProjectOption[];
  portfolioAllowed: boolean;
  selected?: string;
  autoSelected?: boolean;
  error?: string;
}

export function ProjectPicker({
  projects,
  portfolioAllowed,
  selected,
  autoSelected = false,
  error,
}: ProjectPickerProps) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [clientError, setClientError] = useState<string>();

  const hrefFor = useCallback(
    (value: string) => {
      const params = new URLSearchParams(search);
      params.set("project", value);
      return `${pathname}?${params.toString()}`;
    },
    [pathname, search],
  );

  useEffect(() => {
    if (autoSelected && selected) router.replace(hrefFor(selected));
  }, [autoSelected, hrefFor, router, selected]);

  const message = clientError ?? error;
  const status =
    projects.length === 0 ? "選択できるプロジェクトがありません" : selected ? "" : "プロジェクトを選択してください";

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium" htmlFor={id}>
        プロジェクト
      </label>
      <select
        id={id}
        className="w-full rounded border px-3 py-2 text-sm"
        value={selected ?? ""}
        autoFocus={Boolean(message) || selected === undefined}
        aria-invalid={message ? "true" : undefined}
        aria-describedby={`${id}-message`}
        onChange={(event) => {
          const value = event.currentTarget.value;
          if (!projects.some((project) => project.id === value) && !(portfolioAllowed && value === "all")) {
            setClientError("E-AUTH07: このプロジェクトは選択できません");
            return;
          }
          setClientError(undefined);
          router.push(hrefFor(value));
        }}
      >
        <option value="" disabled>
          選択してください
        </option>
        {portfolioAllowed ? <option value="all">すべてのプロジェクト</option> : null}
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.id} — {project.name}
          </option>
        ))}
      </select>
      <p
        id={`${id}-message`}
        role={message ? "alert" : "status"}
        aria-live={message ? "assertive" : "polite"}
        className="text-sm text-gray-600"
      >
        {message ?? status}
      </p>
    </div>
  );
}
