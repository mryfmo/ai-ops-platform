# ADR-0024: Work IQとMicrosoft Graphを人間起点/システム起点で分離する

## Status

Accepted（2026-08-11 Owner 承認。根拠: 承認済み baseline-delta と pack 取込の Owner 承認（PR #152）、P0 フェーズでの本 ADR 群に基づく実行実績、および ENV-DEC-001 / ADR-0029 の Owner 裁定。取込元: docs/plans/2026-08-final-architecture/10_adrs/。承認署名 = 本 Status 変更 PR への Owner approve（ruleset 20678089 強制下）。2026-08-10 取込時は Proposed）

## Decision

Work IQはsigned-in userのdelegated/OBO contextでMicrosoft 365を検索・推論する。Graphはapp-only/background、change notification、delta、正式write、retention/permissionを担当する。Work IQ application-only fallbackは禁止する。

## Consequences

OBO issuer/tenant/audience conformanceが必要。Work IQ outputをexternal LLMへ渡す前にOPAでclassification/minimizationを判定する。
