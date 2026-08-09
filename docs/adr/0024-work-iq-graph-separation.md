# ADR-0024: Work IQとMicrosoft Graphを人間起点/システム起点で分離する

## Status
Proposed（2026-08-10 取込。Owner 承認後に Accepted 化。取込元: docs/plans/2026-08-final-architecture/10_adrs/）

## Decision
Work IQはsigned-in userのdelegated/OBO contextでMicrosoft 365を検索・推論する。Graphはapp-only/background、change notification、delta、正式write、retention/permissionを担当する。Work IQ application-only fallbackは禁止する。

## Consequences
OBO issuer/tenant/audience conformanceが必要。Work IQ outputをexternal LLMへ渡す前にOPAでclassification/minimizationを判定する。
