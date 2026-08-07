/**
 * packages/server/src/lib/degradedCapabilities.ts
 *
 * 根拠: ADR-0014（missing config = disabled + audited）/ ADR-0005 / DevOps:REQ-028。
 *
 *   ADR-0014 の原則自体は正しく、個々の縮退は監査を残す。問題は**縮退が積み重なった状態が
 *   観測不能**なことである。必須 env だけの最小構成で起動すると、Teams コマンド・ingest・
 *   配信・snapshot が全部無効のまま `/healthz` `/readyz` はいずれも 200 を返す
 *   （06 章 D7c で実観測。所見 ADV-INT-052 / ADV-INT-007）。
 *
 *   証跡が監査ログにしか無いと、「有効化されているはずの機能が無効」を監視から検知できない。
 *   ここでは縮退の一覧を機械可読な形にし、呼び出し側が /readyz とメトリクスへ載せられるようにする。
 *
 * lib/agents分離（CLAUDE.md原則1）: 判定のみ。設定の読み取りも出力もしない。
 */

/** 縮退し得る機能。名前はメトリクスのラベルとしてそのまま使う。 */
export const CAPABILITIES = [
  "report_delivery",
  "report_ingest",
  "xlsx_import",
  "teams_persona",
  "llm_free_text",
  "github_outbound",
  "pm_snapshot_reconcile",
  "seven_keys_snapshot",
  "heartbeat",
  "metrics_endpoint",
  "teams_default_channel",
  "telemetry",
  "graph_subscriptions",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/** 各機能が有効かどうか。呼び出し側が config と合成結果から組み立てる。 */
export type CapabilityState = Readonly<Record<Capability, boolean>>;

export interface DegradationReport {
  /** 無効になっている機能。メトリクスと /readyz の双方で使う。 */
  disabled: Capability[];
  /** 1 つでも無効なら true。 */
  degraded: boolean;
}

/**
 * 無効な機能を列挙する。
 *
 * 「無効だから異常」ではない——意図的に無効化した構成もある。ここで返すのは**事実**であり、
 * どれが異常かの判断は監視側の閾値に委ねる。判断をここへ埋め込むと、構成ごとに正しさが
 * 変わる値を実装が決め打つことになる。
 */
export function reportDegradation(state: CapabilityState): DegradationReport {
  const disabled = CAPABILITIES.filter((capability) => !state[capability]);
  return { disabled: [...disabled], degraded: disabled.length > 0 };
}
