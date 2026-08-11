# ADR-0021: Temporalをdurable AI Control Planeの実行正本に採用する

## Status

Accepted（2026-08-11 Owner 承認。根拠: 承認済み baseline-delta と pack 取込の Owner 承認（PR #152）、P0 フェーズでの本 ADR 群に基づく実行実績、および ENV-DEC-001 / ADR-0029 の Owner 裁定。取込元: docs/plans/2026-08-final-architecture/10_adrs/。承認署名 = 本 Status 変更 PR への Owner approve（ruleset 20678089 強制下）。2026-08-10 取込時は Proposed）

## Decision

長期workflow、timer、retry、approval wait、cancellation、compensationをTemporalへ移す。Hono serverはingress、auth、validation、start/signal/query、read model APIに限定する。network/DB/LLM/tool callはActivityで行う。

## Supersession

ADR-0003/0005のin-process scheduler実装を段階的に置換する。常駐ingressと30秒/毎分要件の存在自体は維持し、Temporal schedule/workerで満たす。

## Consequences

workflow determinism、replay、worker versioning、idempotent activitiesが必須。移行中はshadow scheduler比較を行う。
