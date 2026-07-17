<!-- P011-F00-T01 -->

# Acceptance trust bootstrap decision

> **DEV-DEFAULT record** — 本記録は操作者指示（2026-07-18）による開発用既定値であり、Plan 011 の Complete/Negative 基準を本番用途では満たさない。P011-F00-T02 以降の実環境整備と実値差し替えが完了するまで、本記録に基づく受入証跡は development 限定である。

## 開発用既定値

| 項目                                           | 値                                                      |
| ---------------------------------------------- | ------------------------------------------------------- |
| Organization slug                              | `aiops-dev-org`（DEV-DEFAULT・未作成）                  |
| Enterprise Cloud 契約 owner / 請求承認         | mryfmo（DEV-DEFAULT・契約なし・開発フェーズにつき保留） |
| 移管日時                                       | `TBD-at-go-live`（DEV-DEFAULT）                         |
| rollback window                                | 24h（DEV-DEFAULT）                                      |
| named reviewer                                 | `DEV-REVIEWER-1`（DEV-DEFAULT・架空 placeholder）       |
| policy admin 1                                 | `DEV-ADMIN-1`（DEV-DEFAULT・架空 placeholder）          |
| policy admin 2                                 | `DEV-ADMIN-2`（DEV-DEFAULT・架空 placeholder）          |
| Apps/Secrets/Actions/Pages/Packages 影響 owner | mryfmo（DEV-DEFAULT）                                   |
| human decision maker                           | mryfmo                                                  |
| 決定日時                                       | 2026-07-18（実承認 — 本セッション）                     |

## 逸脱と実値差し替え条件

この記録は P011-F00-T01 の本番用 Complete/Negative 基準に対する dev-phase 上書きであり、本番受入の完了証跡ではない。Organization、契約・請求承認、移管日時、named reviewer、policy admin 2名を実在する承認済みの値へ差し替え、各アカウントの所有と役割分離を確認するまで、P011-F00-T02 以降は本番用途では `BLOCKED` のままとする。
