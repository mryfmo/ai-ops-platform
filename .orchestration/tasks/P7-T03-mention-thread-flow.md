# P7-T03: Implement mention and subscribed-thread flow

- task_id: P7-T03
- writer: codex-deep-dot（Owner 指示 2026-08-15 により実務委任。WBS 原記載
  writer=claude。orchestrator は起票・adversarial review・acceptance）
- reviewer: claude-code-fable5-xhigh（orchestrator）
- depends_on: P7-T02 ✅（#252 merged）
- requirement_refs: PRD-001 / FR-UI-001..006
- adr_refs: ADR-0025
- acceptance_gate_ids: UX-001（**Teams sandbox E2E は tenant 到達後** —
  本タスクは決定的 unit/contract tests まで。E2E deferred を validation に明記）
- risk: medium
- **並行注意**: open PR #255/#256/#257。**#257（workbench/grants/server
  config・index 等）の変更ファイルへ接触禁止** — 本タスクは
  packages/channel-teams 内で完結させる（server 結線が必要になったら
  #257 merge 後に要 amendment）

## Canon / 前提

- canon 05_opentag_teams.md: mention/start/follow-up/error の挙動、
  **bot/app loop 無視**、**未 mention の新規 thread は沈黙**、
  recoverable error reporting、Graph との共存（source + platform message ID
  dedupe — P7-T02 の authority を利用）
- P7-T01/T02 の既存構造: ChannelAdapter（pure normalize）/
  ConversationMappingAuthority（lookup 専用）/ AgUiRunRequest。
  **business state を channel 側に持たない**規約の維持

## Objective

**pure な会話 flow 判定**（`packages/channel-teams/src/lib/`）:

1. **flow decision 関数**: 正規化済み inbound message + mapping lookup 結果 +
   bot identity を入力に、`start | follow_up | ignore | error_report` を
   決定的に判定 —
   - **mention 付き新規 thread → start**（mapping 登録要求へ）
   - **subscribed thread（mapping 存在）への返信 → follow_up**（mention 不要）
   - **未 mention の新規 thread → ignore（沈黙）**
   - **bot/app 由来（self/bot id 一致・bot flag）→ ignore（loop 防止）**
   - 判定不能・不正入力 → recoverable error（E-CHANNEL-* 系）
2. mention 解析（Teams の mention entity 形式の strict parse — 表示名文字列
   一致に依存しない。bot id での判定）
3. follow-up の文脈組み立て（AgUiRunRequest への写像 — thread 内の
   継続として mapping の conversation/workflow を再利用）
4. tests: 判定 matrix（mention×新規/既存 thread×bot/human×mapping 有無の
   全組合せ）+ mention parse の負 fixture（偽装表示名・空 entity・
   多重 mention）+ loop 防止（bot 自身の echo・別 bot・app message）

## Acceptance（WBS）

- bot/app loops ignored（機械検証）
- fresh unmentioned thread silent（機械検証）

## Forbidden

- channel 側への状態保持 / server・workbench 面への接触（#257 対象）
- 表示名文字列での mention 判定 / 依存追加 / 実資格情報
- main direct push / merge / approve

## Scope / allowed_paths（WBS）

- `packages/channel-teams/src/**` + `packages/channel-teams/tests/**`
- `.orchestration/**`（証跡）

## Validation

- 判定 matrix tests green / fresh DB で `mise run ci` exit 0（単独判定）
- Teams sandbox E2E は deferred（tenant 到達後）と validation に明記

## PR / blocked-auth

- branch `agent/P7-T03-mention-thread-flow`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation / sandbox / learning / autoskill:
  `.orchestration/*/P7-T03-*.md`

## Done signal

AGMSG-RESULT v1 task_id=P7-T03 status=ready_for_review

## Flow matrix 裁定（2026-08-17、orchestrator — worker 提案へ 2 点是正）

- 承認: bot/app/self → 常に ignore / human reply + mapping → follow_up /
  root + mapping（整合性異常）→ error_report / strict entity parser
  （表示名不使用・malformed/空 entity 拒否）
- **是正 1**: `reply + no mapping` は error_report ではなく —
  - bot mention **なし** → **ignore**（bot 未関与 thread の通常会話は沈黙。
    error 化すると全社の雑談に反応する）
  - bot mention **あり** → **start**（thread 途中の明示召喚 = 購読開始。
    canon の mention/start 意味論と OpenTag pattern に整合）
- **是正 2**: multi-mention の扱い — 「bot を対象とする mention entity が
  ちょうど 1 つ」であれば、**追加の人間宛 mention は許容**して start
  （bot + 同僚を同時 mention する実務的な起動を弾かない）。
  bot 宛 mention が 0 or 2+ は従来どおり ignore。実装が煩雑なら
  conservative（single-entity のみ start）も可 — その場合は Teams sandbox
  E2E 段階での精緻化項目として validation に記録
