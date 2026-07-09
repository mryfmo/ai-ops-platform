/**
 * packages/web/src/server/reportData/timeseriesHandler.ts
 *
 * 根拠: ADR-0007 / REQ-036 / SPEC-INT-062 / REQ-031 / SPEC-INT-081.
 * GET /api/data/timeseries のハンドラ本体。pm_events/pm_snapshotsを権限範囲で絞って期間集計する。
 */
import type { Session } from "next-auth";
import {
  aggregateTimeseries,
  resolvePeriodRange,
  type PeriodKind,
  type PgQueryable,
  type TimeseriesEventInput,
  type TimeseriesSnapshotInput,
} from "@aiops/shared";
import { isProjectInScope as isPrjopsProjectInScope } from "@aiops/prjops";
import { isProjectInScope as isDevopsProjectInScope } from "@aiops/devops";
import type { PersonaResolver, ResolvedPersona } from "../personaResolver";
import { ForbiddenError } from "../authGuard";
import { resolvePersonas, toErrorResponse } from "./dataApiSupport";

export interface TimeseriesHandlerDeps {
  getSession: () => Promise<Session | null>;
  resolver: PersonaResolver;
  db: PgQueryable;
  period: PeriodKind;
  baseDate: string;
  persona?: "executive" | "manager" | "investor";
}

interface PmEventRow {
  event_name: string;
  action: string | null;
  project_id: string | null;
  occurred_at: string | Date;
  from_status: string | null;
  to_status: string | null;
}

interface PmSnapshotRow {
  project_id: string | null;
  source_type: string;
  state: string | null;
  captured_at: string | Date;
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function eventKind(eventName: string): TimeseriesEventInput["kind"] {
  if (eventName === "pull_request") return "pull_request";
  if (eventName === "milestone") return "milestone";
  if (eventName === "projects_v2_item") return "projects_v2_item";
  if (eventName === "projects_v2_status_update") return "projects_v2_status_update";
  if (eventName === "deployment" || eventName === "deployment_status") return "deployment";
  return "issue";
}

function choosePersona(personas: ResolvedPersona[], requested?: TimeseriesHandlerDeps["persona"]): ResolvedPersona {
  if (requested === "investor") {
    const persona = personas.find((p) => p.domain === "investor");
    if (persona) return persona;
  }
  if (requested === "executive") {
    const persona = personas.find((p) => p.domain === "prjops" && p.profile === "PRF-04");
    if (persona) return persona;
  }
  if (requested === "manager") {
    const persona = personas.find(
      (p) => (p.domain === "prjops" && p.profile === "PRF-03") || (p.domain === "devops" && p.profile === "PRF-G"),
    );
    if (persona) return persona;
  }
  const fallback = personas[0];
  if (!fallback) throw new ForbiddenError("E-AUTH02: timeseries requires persona");
  return fallback;
}

function canSeeProject(persona: ResolvedPersona, projectId: string | null): boolean {
  if (!projectId) return true;
  if (persona.domain === "investor") return isPrjopsProjectInScope("investor", projectId, persona.visibility);
  if (persona.domain === "prjops") return isPrjopsProjectInScope(persona.profile, projectId, persona.visibility);
  return isDevopsProjectInScope(persona.profile, projectId, persona.visibility);
}

export async function handleTimeseries(deps: TimeseriesHandlerDeps): Promise<Response> {
  try {
    const personas = await resolvePersonas(deps.getSession, deps.resolver);
    const persona = choosePersona(personas, deps.persona);
    const range = resolvePeriodRange(deps.period, deps.baseDate);
    const [eventRows, snapshotRows] = await Promise.all([
      deps.db.query(
        `SELECT event_name, action, project_id, occurred_at, from_status, to_status
         FROM pm_events WHERE occurred_at >= $1 AND occurred_at < $2 ORDER BY occurred_at`,
        [range.start, range.end],
      ),
      deps.db.query(
        `SELECT project_id, source_type, state, captured_at
         FROM pm_snapshots WHERE captured_at >= $1 AND captured_at < $2 ORDER BY captured_at`,
        [range.start, range.end],
      ),
    ]);

    const events: TimeseriesEventInput[] = (eventRows.rows as unknown as PmEventRow[])
      .filter((row) => canSeeProject(persona, row.project_id))
      .map((row) => ({
        occurredAt: toIso(row.occurred_at),
        kind: eventKind(row.event_name),
        projectId: row.project_id,
        action: row.action,
        fromStatus: row.from_status,
        toStatus: row.to_status,
      }));
    const snapshots: TimeseriesSnapshotInput[] = (snapshotRows.rows as unknown as PmSnapshotRow[])
      .filter((row) => canSeeProject(persona, row.project_id))
      .map((row) => ({
        capturedAt: toIso(row.captured_at),
        sourceType:
          row.source_type === "project_item"
            ? "project_item"
            : (row.source_type as TimeseriesSnapshotInput["sourceType"]),
        projectId: row.project_id,
        state: row.state,
      }));

    return Response.json(aggregateTimeseries({ period: deps.period, baseDate: deps.baseDate, events, snapshots }));
  } catch (err) {
    return toErrorResponse(err);
  }
}
