<!-- 根拠: FinalArch:FR-CP-008 / FinalArch:GOV-004 / FinalArch:GOV-005 / FinalArch:INV-013 / ADR-0020 -->

# 移行 Feature Flag / Kill-Switch 契約（P0-T08）

flag 定義の正本は
[08_feature_flags.yaml](../plans/2026-08-final-architecture/06_implementation/08_feature_flags.yaml)。
本書はその意味論をコードに落とした
`packages/shared/src/migration/featureFlags.ts` の利用契約を定める。
**flag の追加・変更は正本 YAML → レジストリ → 本書の順で同一 PR 内で行う。**

## 環境変数規約

| 形式                                 | 意味                                                               |
| ------------------------------------ | ------------------------------------------------------------------ |
| `AIOPS_FLAG_<DOTTED名のSNAKE大文字>` | stage 値（`disabled` / `shadow` / `limited` / `primary`）          |
| `AIOPS_FLAG_<...>_KILL=1`            | kill switch（`killSwitch: true` の flag のみ。stage 設定より強い） |

例: `control.temporal.enabled` → `AIOPS_FLAG_CONTROL_TEMPORAL_ENABLED=shadow`。

## fail closed の規則（resolveMigrationFlags）

1. 未設定・空文字は**正本 default**（`control.legacy_scheduler.enabled` のみ `true`、他は `false`）。
   新経路はオプトインでのみ起動する
2. 未知の stage 値・その flag で許可されない stage は **E-FLAG01**（起動失敗）
3. 永続 off（`aiops.auto_production_remediation` / `cloudflare.artifacts` / `notion.baseline`）への
   有効化指定は **E-FLAG02**（起動失敗）。コード側でも `immutableFalse` で二重に強制する
4. 相互排他は正本どおり `control.legacy_scheduler.enabled` 側に宣言され、legacy が `false` でないまま
   `control.temporal.enabled=primary` にすると **E-FLAG03**（一本書き手の保証）。legacy は default `true` のため、
   temporal 正系化には `AIOPS_FLAG_CONTROL_LEGACY_SCHEDULER_ENABLED=false` の明示が必須。
   server はこの解決状態で in-process scheduler の起動自体を gate する
5. 未知の `AIOPS_FLAG_*` 変数は **E-FLAG04**。typo が「無効のまま黙って稼働」になることを防ぐ。
   kill switch の不正値（`true` 等）は **E-FLAG05** で起動失敗（fail open 禁止）
6. server は `loadConfig()` がこれらを **E-CFG01 として起動時に fail-fast** させ、
   解決済み状態を `config.MIGRATION_FLAGS` として公開する

## 消費側の義務

- 新経路の実装は必ず `config.MIGRATION_FLAGS.get("<flag名>")` を参照し、`false` では起動しない。
  staged flag はその flag の ladder の意味論（例: temporal は `shadow` 並走・結果破棄 →
  `limited` 対象限定 → `primary` 正系）に従う
- kill switch 発動・stage 変更の運用記録は監査ログ（追記専用）に残す
- grandfather 規則（PACK-05）: 既存機能の既存 config（例: `REPORT_DELIVERY_ENABLED`）は
  本レジストリへ移設しない。本レジストリは**最終アーキテクチャ移行経路専用**である
