# ADR-0021: Temporalをdurable AI Control Planeの実行正本に採用する

## Status
Proposed（2026-08-10 取込。Owner 承認後に Accepted 化。取込元: docs/plans/2026-08-final-architecture/10_adrs/）

## Decision
長期workflow、timer、retry、approval wait、cancellation、compensationをTemporalへ移す。Hono serverはingress、auth、validation、start/signal/query、read model APIに限定する。network/DB/LLM/tool callはActivityで行う。

## Supersession
ADR-0003/0005のin-process scheduler実装を段階的に置換する。常駐ingressと30秒/毎分要件の存在自体は維持し、Temporal schedule/workerで満たす。

## Consequences
workflow determinism、replay、worker versioning、idempotent activitiesが必須。移行中はshadow scheduler比較を行う。
