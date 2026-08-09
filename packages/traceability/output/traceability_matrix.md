# トレーサビリティ検証結果

生成日時: 2026-08-09T22:52:23.416Z

凡例: 「source参照あり」= `packages/*/src` 配下のコード（コメント含む）にIDが1回以上出現。
「テスト参照あり」= `packages/*/tests` 配下のテストコードにIDが1回以上出現。
注記: 参照の存在は構文上の接続だけを示し、要件の振る舞いを検証した証明ではありません。
ISS/TOBE/ASMは文書間トレーサビリティの記録用IDであり、実装コードへの直接参照を必須としない（参考値）。

## PrjOps

| カテゴリ   | 総数 | source参照あり | テスト参照あり | source参照なし                                                                                                                                                                            |
| ---------- | ---- | -------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REQ        | 35   | 35 (100%)      | 27 (77%)       | —                                                                                                                                                                                         |
| SPEC-EXT   | 27   | 22 (81%)       | 7 (26%)        | PrjOps:SPEC-EXT-001, PrjOps:SPEC-EXT-002, PrjOps:SPEC-EXT-022, PrjOps:SPEC-EXT-028, PrjOps:SPEC-EXT-031                                                                                   |
| SPEC-INT   | 31   | 31 (100%)      | 26 (84%)       | —                                                                                                                                                                                         |
| AC         | 39   | 28 (72%)       | 29 (74%)       | PrjOps:AC-001-2, PrjOps:AC-002-2, PrjOps:AC-003-1, PrjOps:AC-003-2, PrjOps:AC-003-3, PrjOps:AC-004-1, PrjOps:AC-005-3, PrjOps:AC-006-1, PrjOps:AC-006-2, PrjOps:AC-020-2, PrjOps:AC-036-1 |
| ISS(参考)  | 10   | 1 (10%)        | 1 (10%)        | PrjOps:ISS-002, PrjOps:ISS-003, PrjOps:ISS-004, PrjOps:ISS-005, PrjOps:ISS-006, PrjOps:ISS-007, PrjOps:ISS-008, PrjOps:ISS-009, PrjOps:ISS-010                                            |
| TOBE(参考) | 10   | 2 (20%)        | 0 (0%)         | PrjOps:TOBE-02, PrjOps:TOBE-03, PrjOps:TOBE-04, PrjOps:TOBE-05, PrjOps:TOBE-06, PrjOps:TOBE-07, PrjOps:TOBE-08, PrjOps:TOBE-09                                                            |
| ASM(参考)  | 7    | 4 (57%)        | 3 (43%)        | PrjOps:ASM-001, PrjOps:ASM-005, PrjOps:ASM-007                                                                                                                                            |

## DevOps

| カテゴリ  | 総数 | source参照あり | テスト参照あり | source参照なし                                                                                                                                                                                                                                 |
| --------- | ---- | -------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REQ       | 27   | 27 (100%)      | 18 (67%)       | —                                                                                                                                                                                                                                              |
| SPEC-EXT  | 25   | 18 (72%)       | 7 (28%)        | DevOps:SPEC-EXT-002, DevOps:SPEC-EXT-003, DevOps:SPEC-EXT-011, DevOps:SPEC-EXT-012, DevOps:SPEC-EXT-031, DevOps:SPEC-EXT-032, DevOps:SPEC-EXT-044                                                                                              |
| SPEC-INT  | 31   | 31 (100%)      | 19 (61%)       | —                                                                                                                                                                                                                                              |
| TH        | 7    | 7 (100%)       | 7 (100%)       | —                                                                                                                                                                                                                                              |
| AC        | 45   | 30 (67%)       | 22 (49%)       | DevOps:AC-001a, DevOps:AC-001b, DevOps:AC-010b, DevOps:AC-015a, DevOps:AC-015b, DevOps:AC-016a, DevOps:AC-016b, DevOps:AC-018c, DevOps:AC-019a, DevOps:AC-020a, DevOps:AC-021a, DevOps:AC-022a, DevOps:AC-027a, DevOps:AC-029a, DevOps:AC-030a |
| ISS(参考) | 8    | 0 (0%)         | 0 (0%)         | DevOps:ISS-01, DevOps:ISS-02, DevOps:ISS-03, DevOps:ISS-04, DevOps:ISS-05, DevOps:ISS-06, DevOps:ISS-07, DevOps:ISS-08                                                                                                                         |

## Implementation Dispositions

この表はsource参照の存在と要件完了を分離する。`partial`は未完了、`superseded`は原仕様を置換済みだが保持義務の完了を意味せず、greenの完成証明ではない。

| ID                  | 状態       | 置換先                                               | 実装済み範囲                                                                                                                | 未完了・保持義務                                                                                                                                                                 | 根拠                                                                                                                                             | Owner             |
| ------------------- | ---------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| PrjOps:REQ-011      | partial    | —                                                    | PRF-01本人のアクション期限順・参加プロジェクト色表示<br>参加プロジェクトと本人課題の取得側フィルタ                          | 正本データからの受信者別生成とAGT-07検証・配信の本番結線<br>月曜08:00 JST境界とN受信者N成果物の統合検証                                                                          | docs/spec/prjops/03_PRD.md<br>docs/audit/09-remediation-plan.md                                                                                  | T-P0-11           |
| PrjOps:REQ-030      | partial    | —                                                    | 外部I/Oなしの100案件・2,000受信者 分析→個別生成→AGT-07検証baseline                                                          | 正本取得・受信者解決・全profile・永続化を含む本番同等経路の測定<br>代表環境のcommit SHA・開始終了時刻・失敗0件の証跡                                                             | docs/spec/prjops/03_PRD.md<br>docs/audit/09-remediation-plan.md                                                                                  | P010-F06-T17      |
| PrjOps:SPEC-INT-010 | superseded | ADR-0001<br>DEC-SPEC-001<br>DEC-SPEC-004<br>ADR-0014 | prjops-systemをai-ops-platform monorepoのpackages/prjopsへ置換<br>prjops-dataとreport archiveを注入可能な論理境界として分離 | private prjops-data repositoryとmachine account/PRF-03書込制御<br>immutable 40-character SHAでのproduction読込と環境証跡<br>PostgreSQL/LTR archiveのretention・権限・restore証跡 | docs/spec/prjops/05_内部仕様書.md<br>docs/adr/0001-monorepo.md<br>docs/adr/0014-integration-delivery.md<br>docs/spec/productization-decisions.md | P010-F02-T01..T14 |

## Traceability Guards

- 根拠ヘッダ不足: —
- 存在しないADR参照: —
- 名前空間参照不正: —
- 仕様IDインデックス不正: —
- disposition不正: —
- 仕様IDカタログ不正: —
- 設定変数インベントリ不整合: —
