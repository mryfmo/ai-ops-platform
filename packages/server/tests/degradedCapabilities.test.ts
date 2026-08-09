/**
 * packages/server/tests/degradedCapabilities.test.ts
 *
 * 根拠: ADR-0014 / ADR-0005 / DevOps:REQ-028。縮退が積み重なった状態を機械可読にする判定を検証する。
 *   所見 ADV-INT-052 / ADV-INT-007 / ADV-INT-050。
 */
import { describe, expect, it } from "vitest";
import {
  CAPABILITIES,
  deriveCapabilityState,
  reportDegradation,
  type CapabilityInputs,
  type CapabilityState,
} from "../src/lib/degradedCapabilities.js";

const allEnabled = Object.fromEntries(CAPABILITIES.map((c) => [c, true])) as CapabilityState;
const allDisabled = Object.fromEntries(CAPABILITIES.map((c) => [c, false])) as CapabilityState;
const allConfigured: CapabilityInputs = {
  reportDeliveryEnabled: true,
  fromMailboxConfigured: true,
  reportIngestConfigured: true,
  xlsxImportConfigured: true,
  teamsPersonaConfigured: true,
  llmFreeTextConfigured: true,
  githubConfigured: true,
  githubProjectConfigured: true,
  sevenKeysSnapshotConfigured: true,
  heartbeatConfigured: true,
  metricsEndpointConfigured: true,
  defaultTeamsTeamConfigured: true,
  defaultTeamsChannelConfigured: true,
  telemetryConfigured: true,
  graphSubscriptionsPresent: true,
  approvalsConfigured: true,
  prjopsDataConfigured: true,
  pmoNotifyMailboxConfigured: true,
};

describe("deriveCapabilityState [ADR-0014 / DevOps:SPEC-INT-040]", () => {
  it("GitHub認証とproject nodeの合成境界を固定する [DevOps:SPEC-INT-040]", () => {
    expect(
      deriveCapabilityState({ ...allConfigured, githubConfigured: false, githubProjectConfigured: true }),
    ).toMatchObject({ github_outbound: false, xlsx_import: false, pm_snapshot_reconcile: false });
    expect(deriveCapabilityState({ ...allConfigured, githubProjectConfigured: false })).toMatchObject({
      github_outbound: true,
      xlsx_import: true,
      pm_snapshot_reconcile: false,
    });
  });

  it("配信・既定Teams channel・Graph購読の合成境界を固定する [DevOps:SPEC-INT-040]", () => {
    expect(
      deriveCapabilityState({
        ...allConfigured,
        fromMailboxConfigured: false,
        defaultTeamsChannelConfigured: false,
        graphSubscriptionsPresent: false,
      }),
    ).toMatchObject({ report_delivery: false, teams_default_channel: false, graph_subscriptions: false });
  });

  it("AGT_BLD/AGT_INC は必要な外部依存が欠けたら縮退する [ADR-0014 / DevOps:SPEC-INT-011/030]", () => {
    expect(deriveCapabilityState({ ...allConfigured, llmFreeTextConfigured: false })).toMatchObject({
      build_triage: false,
      incident_triage: false,
    });
    expect(deriveCapabilityState({ ...allConfigured, githubConfigured: false })).toMatchObject({
      build_triage: false,
      incident_triage: false,
    });
    expect(deriveCapabilityState({ ...allConfigured, defaultTeamsChannelConfigured: false })).toMatchObject({
      build_triage: true,
      incident_triage: false,
    });
  });

  it("AUD-OPM-001: identity secret未設定をapprovals縮退として公開する", () => {
    expect(deriveCapabilityState({ ...allConfigured, approvalsConfigured: false })).toMatchObject({
      approvals: false,
    });
  });

  it("A046: pinned data/FROM_MAILBOX/PMO mailbox依存を個別に縮退公開する", () => {
    expect(deriveCapabilityState({ ...allConfigured, prjopsDataConfigured: false })).toMatchObject({
      prjops_weekly_analysis: false,
      prjops_daily_tracking: false,
    });
    expect(deriveCapabilityState({ ...allConfigured, fromMailboxConfigured: false })).toMatchObject({
      prjops_daily_tracking: false,
      prjops_job_escalation: false,
    });
    expect(deriveCapabilityState({ ...allConfigured, pmoNotifyMailboxConfigured: false })).toMatchObject({
      prjops_job_escalation: false,
    });
  });
});

describe("reportDegradation [ADR-0014 / DevOps:REQ-028]", () => {
  it("全機能が有効なら縮退なし [DevOps:REQ-028]", () => {
    expect(reportDegradation(allEnabled)).toEqual({ disabled: [], degraded: false });
  });

  it("必須envのみの最小構成に相当する全無効を列挙する [DevOps:REQ-028]", () => {
    // 06章D7cで実観測した状態。従来これは /healthz /readyz とも 200 で、外からは健全に見えた。
    const report = reportDegradation(allDisabled);

    expect(report.degraded).toBe(true);
    expect(report.disabled).toEqual([...CAPABILITIES]);
  });

  it.each([...CAPABILITIES])("%s だけが無効でも検出する [DevOps:REQ-028]", (capability) => {
    const report = reportDegradation({ ...allEnabled, [capability]: false });

    expect(report.degraded).toBe(true);
    expect(report.disabled).toEqual([capability]);
  });

  it("購読ゼロを縮退として扱う（台帳行の消失が監査すら残さず止まる問題） [DevOps:REQ-028]", () => {
    const report = reportDegradation({ ...allEnabled, graph_subscriptions: false });

    expect(report.disabled).toContain("graph_subscriptions");
  });
});
