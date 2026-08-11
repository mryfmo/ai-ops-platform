# A026: Teams code_task の projectId 越境防止

- task_id: A026
- repo: /Users/mryfmo/Workspace/ai-ops-platform (worktree は割当時に指定)
- 発行: orchestrator-fable5 (2026-08-05)
- 担当: (割当時に記入)
- max_turns: 40
- 根拠: `docs/audit/2026-08-05-adversarial-review/03-security-governance.md` ADV-SEC-003、
  AGENTS.md 設計原則 6（権限フィルタはデータ取得側で強制）、ADR-0006

## 背景（推測で補わないこと）

`packages/server/src/agents/teamsConversationAgent.ts:431-436` は、コーディングタスクを台帳へ INSERT する際に `intent.projectId` を**そのまま**使い、発信元チャネルの `channel.projectId` と突合していない。

`intent.projectId` の出所は 2 通りあり、いずれも信頼できない。

- 自由文経路: `packages/server/src/lib/freeTextIntent.ts:45` — **LLM が本文から抽出した値**
- slash 経路: ユーザーが `/code_task PJ-999 ...` と直接指定した値

一方、権限判定 `resolveCallerProfile` は `channel.projectId`（発信元）に対して行われる。したがって **プロジェクト A のチャネルから、A の権限のまま B のリポジトリに対するタスクを作成できる**。確認ページに projectId は表示されるが、人間が見落として承認すれば越境実行になる。

確認リンク先の `packages/server/src/http/routes/codingTasks.ts:149` は `resolveRepoForProject(task.projectId)` で対象リポジトリを決めるため、台帳に入った時点で越境が確定する。

対照として、`gh_*` 系コマンドはチャネル紐付けの owner/repo を使っており安全。**この非対称が本所見の本質**。

## 前提手順

1. `origin/main` から新ブランチ `agent/a026-teams-projectid-scope` を作成。
2. `teamsConversationAgent.ts` 全文と `freeTextIntent.ts`、`packages/prjops/src/lib/commandParser.ts` を読了。
3. `gh_*` 系コマンドが channel 由来の値をどう使っているかを確認し、同じ扱いに揃えられるかを判断する。

## 実装要件

- code_task の台帳登録前に、`intent.projectId` と発信元 `channel.projectId` を突合する。
- **不一致時の挙動は「拒否 + 監査記録 + 利用者への明示的な返信」**とする。silent に握りつぶさないこと（ADV-WIR-006 で「無応答で握りつぶす」ことが別途 High 所見になっている。同じ轍を踏まない）。
  - `channel.projectId` で上書きする案もあり得るが、利用者が別プロジェクトを意図して書いた可能性があるため、黙って書き換えるのは避ける。上書き方式を採る場合は**利用者への返信でその旨を明示**すること。
- 返信は既存の `reply()` 経路を通す（`:509-516` で `sanitizeSecrets` が一律適用される最終防波堤があるため）。
- 監査記録は既存の監査ログ経路を使い、`basis` に本タスクの根拠 ID を入れる。

## テスト

- 一致時: 従来どおり台帳登録される。
- 不一致時（自由文経路 / slash 経路の両方）: 台帳へ INSERT されず、監査ログが残り、利用者へ返信される。
- `gh_*` 系の既存挙動が変わらないこと（回帰）。
- describe/it タイトルに検証対象の仕様 ID を含める（AGENTS.md テスト規約）。

## 判断が必要になったら

拒否メッセージの文言、監査 action 名は本タスクの裁量。ただし次は**推測せず `status=blocked`**。

- 1 チャネルが複数プロジェクトに正当に紐づく運用が既存仕様に存在する場合（その場合は突合ロジックの前提が崩れる）
- `action_add` / `action_done` / `issue_close` / `status_override` の握りつぶし（ADV-WIR-006）まで直したくなった場合 → **本タスクの範囲外**。オーナー裁定 D-02 待ちで別途起票する。`allowed_files` は同じファイルだが、変更はこの 4 コマンドに及ばせないこと。

## 品質要件

- 根拠 ID ヘッダの規約を維持。
- `MISE_LOCKED=1 mise run ci` green。
- crit CLI で自己レビュー（resolved まで）。
- push → PR（base=main、`ai-generated` ラベル）→ checks green → AGMSG-RESULT。merge は受入後。

## 完了条件

- [ ] `intent.projectId != channel.projectId` の code_task が台帳に入らない
- [ ] 拒否時に監査ログが残り、利用者へ返信が届く（返信は `reply()` 経由）
- [ ] 一致時・不一致時・`gh_*` 回帰の 3 系統にテストがあり、仕様 ID がタイトルに含まれる
- [ ] `MISE_LOCKED=1 mise run ci` exit 0

## forbidden_actions

- `allowed_files` 以外の編集
- `action_add` / `action_done` / `issue_close` / `status_override` の挙動変更（D-02 裁定待ち）
- `codingTasks.ts` ルート側の変更（A027 の担当範囲。衝突を避けること）
- 依存追加、schema.sql / migration の変更
- 実 Graph API 呼び出し、実 LLM 呼び出し
- merge-before-acceptance、`docs/audit/` 配下の編集、ユーザーへのレビュー依頼

## allowed_files

```
packages/server/src/agents/teamsConversationAgent.ts
packages/server/tests/teamsConversationAgent.test.ts
```

**注**: テストファイルは上記の実名のみ。他タスクと並列実行されるため、ワイルドカードで確保しないこと。新規テストファイルが必要な場合は `packages/server/tests/a026-*.test.ts` の接頭辞で作成し、report に列挙する。`app.test.ts` は A023 が保持しているため触らない。

## 完了報告

```
AGMSG-RESULT v1 task_id=A026 status=ready_for_review|blocked report=.orchestration/reports/A026-report.md validation=.orchestration/validation/A026-validation.md sandbox=.orchestration/sandboxes/A026-sandbox.md learning=.orchestration/learning/A026-learning.md autoskill=.orchestration/autoskill/runs/A026-autoskill.md
```
