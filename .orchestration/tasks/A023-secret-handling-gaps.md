# A023: 秘密の取り扱い強化（events 保存前サニタイズ・system プロンプト）

- task_id: A023
- repo: /Users/mryfmo/Workspace/ai-ops-platform (worktree は割当時に指定)
- 発行: orchestrator-fable5 (2026-08-05)
- 担当: (割当時に記入)
- max_turns: 50
- 根拠: `docs/audit/2026-08-05-adversarial-review/03-security-governance.md` ADV-SEC-004 / ADV-SEC-007、
  AGENTS.md 設計原則 4（秘密情報の多層防御）、PrjOps:REQ-032 / DevOps:REQ-030

## 背景（推測で補わないこと）

AGENTS.md 設計原則 4 は「外部から受けたテキストは (a) DB 保存前 `sanitizeSecrets()`、(b) LLM 入力前 `sanitizeForLlmInput()`、(c) ログ・PR コメント出力前」の三層を要求する。実測した違反は 2 箇所。

1. **ADV-SEC-004（層 a の反例）**: `packages/server/src/http/routes/githubWebhook.ts:67` が署名検証後の `payload` をそのまま enqueue し、`packages/server/src/db/eventsRepo.ts:111,117` が `JSON.stringify(payload)` を sanitize なしで INSERT する。commit メッセージや issue/PR 本文に混入したトークンが平文で `events` テーブルに残り、dead-letter 行は長期残存し得る。
   - 対照（既に適合している実装）: Graph 通知側 `graphNotifications.ts:131-141` はメタデータのみ保存、Teams 本文は取得時に sanitize 済み（`teamsConversationAgent.ts:218`）。**GitHub 経路だけが穴**。
2. **ADV-SEC-007（層 b の穴）**: `packages/shared/src/clients/anthropicClient.ts:308` は `opts.user` のみ sanitize し、`:360` は `opts.system` を生のまま送信する。**現時点の全呼び出し元は system が静的文字列またはプロファイル enum 補間のみ**（AGT-02/03/04、AGT_BLD、AGT_INC、AGT_CHG、freeTextIntent、web systemPrompt を確認済み）で実害は無いが、将来の呼び出し追加で無防備になる構造が残っている。

## 前提手順

1. `origin/main` から新ブランチ `agent/a023-secret-handling-gaps` を作成。
2. `packages/shared/src/secretSanitizer.ts` を全文読了し、`sanitizeSecrets` のオプション（特に `maskSuspiciousSequences`）と戻り値の形を把握する。
3. `packages/server/tests/` 配下の既存 webhook / eventsRepo テストの書き方に合わせること。

## 実装要件

### 1. events への保存前サニタイズ（ADV-SEC-004）

- GitHub webhook 由来の payload が `events` テーブルへ入る前に `sanitizeSecrets` を通す。
- **適用位置は `eventsRepo.enqueue` 内で一律**とするのが望ましい（呼び出し元の追加漏れを構造的に防ぐため）。ただし既存の Graph 経路・inbound 経路に二重適用の副作用が無いことを確認し、report に根拠を書くこと。二重適用が問題になる設計なら `githubWebhook.ts` 側で適用してもよいが、その判断理由を report に明記する。
- **署名検証は生ボディに対して行う現在の順序（`githubWebhook.ts:30-49`）を壊さないこと。** sanitize は検証後・保存前に行う。
- payload は入れ子 JSON なので、文字列フィールドを再帰的に処理する必要がある。既存 sanitizer の入出力型に合わせ、構造を保ったまま値だけ置換すること。

### 2. system プロンプトのサニタイズ（ADV-SEC-007）

- `anthropicClient.call()` 内で `opts.system` にも `sanitizeForLlmInput` を適用する（`opts.user` と同じ扱い）。
- 既存の呼び出し元の挙動が変わらないこと（静的 system 文字列は sanitize しても不変であるはず）をテストで示す。

### 3. テスト

- 秘密パターンを含む GitHub webhook payload を投入し、`events` へ INSERT される SQL 引数に秘密が含まれないことを検証する（既存の fake `query()` 方式でよい）。
- dead-letter 経路（attempts 上限到達）でも秘密が残らないことを確認する。
- system プロンプトに秘密文字列を渡した場合にマスクされることを検証する。
- describe/it タイトルに検証対象の仕様 ID を含める（AGENTS.md テスト規約）。

## 判断が必要になったら

適用位置（enqueue 内 vs ルート側）は本タスクの裁量。ただし次は**推測せず `status=blocked`**。

- sanitizer のパターン表そのものを拡張する必要があると判断した場合 → **オーナー裁定 D-09 の対象**。本タスクの範囲外（ADV-SEC-006 として別途起票済み）。`maskSuspiciousSequences` の既定値も変更しないこと。
- 既存の監査ログ経路（`pgAuditLog.ts` の E-AUD02 判定）と競合する場合

## 品質要件

- 根拠 ID ヘッダを変更ファイルの規約に従って維持。
- `MISE_LOCKED=1 mise run ci` green（traceability 含む）。
- crit CLI で自己レビュー（resolved まで）。
- push → PR（base=main、`ai-generated` ラベル）→ checks green → AGMSG-RESULT。merge は受入後。

## 完了条件

- [ ] GitHub webhook payload が sanitize を経て `events` に保存される
- [ ] 署名検証が生ボディに対して行われる順序が保たれている
- [ ] `anthropicClient.call()` が `system` にもサニタイズを適用する
- [ ] 上記 3 点それぞれにテストがあり、仕様 ID がタイトルに含まれる
- [ ] `MISE_LOCKED=1 mise run ci` exit 0

## forbidden_actions

- `allowed_files` 以外の編集
- `packages/shared/src/secretSanitizer.ts` の編集（D-09 裁定待ちのため本タスクでは触らない）
- 依存追加、schema.sql / migration の変更
- 実 LLM API 呼び出し、実 GitHub API 呼び出し
- merge-before-acceptance、`docs/audit/` 配下の編集、ユーザーへのレビュー依頼

## allowed_files

```
packages/server/src/db/eventsRepo.ts
packages/server/src/http/routes/githubWebhook.ts
packages/shared/src/clients/anthropicClient.ts
packages/server/tests/eventsRepo.test.ts
packages/server/tests/app.test.ts
packages/shared/tests/anthropicClient.test.ts
```

**注**: テストファイルは上記の実名のみ。他タスクと並列実行されるため、ワイルドカードで確保しないこと。新規テストファイルが必要な場合は `packages/server/tests/a023-*.test.ts` の接頭辞で作成し、report に列挙する。`packages/shared/tests/secretSanitizer.test.ts` は D-09 裁定待ちのため触らない。

## 完了報告

```
AGMSG-RESULT v1 task_id=A023 status=ready_for_review|blocked report=.orchestration/reports/A023-report.md validation=.orchestration/validation/A023-validation.md sandbox=.orchestration/sandboxes/A023-sandbox.md learning=.orchestration/learning/A023-learning.md autoskill=.orchestration/autoskill/runs/A023-autoskill.md
```
