# A025: configuration.md の変数表を実装と一致させる

- task_id: A025
- repo: /Users/mryfmo/Workspace/ai-ops-platform (worktree は割当時に指定)
- 発行: orchestrator-fable5 (2026-08-05、同日改訂)
- 担当: (割当時に記入)
- max_turns: 25
- 根拠: `docs/audit/2026-08-05-adversarial-review/05-ops-readiness.md` ADV-OPS-012

## 改訂の経緯（重要）

本タスクの当初の主題は ADV-VER-013「AGENTS.md が Node 20 / pnpm 9 と記載」だったが、
**この所見は誤りで撤回された**。origin/main の `AGENTS.md:8` は「Node 22 / pnpm 11」で
`.mise.toml:3-4` と一致している。誤りの原因はレビュー対象コミットではなく 190 コミット
遅れたローカルブランチの版を読んだこと。PR #122 のレビューで指摘され撤回済み。

**AGENTS.md には手を触れないこと。** 残る有効な指摘は下記 1 点のみ。

## 背景（2026-08-05 実地確認済み）

`docs/reference/configuration.md:61` が「上表は exact Zod-schema inventory」と主張して
いるが、server 表から次の変数が欠落している。

- `METRICS_TOKEN`
- `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` / `GITHUB_APP_INSTALLATION_ID`
- `STAKEHOLDERS_DIR`
- `HEARTBEAT_URL`
- `ANTHROPIC_DEFAULT_MODEL` / `ANTHROPIC_ESCALATION_MODEL` / `ANTHROPIC_PRICING_USD_PER_MTOK`

## 前提手順

1. `origin/main` から新ブランチ `agent/a025-configuration-inventory` を作成。
2. `packages/server/src/config.ts` の Zod スキーマ全体と `packages/web/src/server/config.ts`、
   および `.env.example` を読了する。
3. **実装を唯一の正とし、実装から文書へ写す。** 逆向きは禁止。

## 実装要件

- `config.ts` の Zod スキーマに存在する変数がすべて表にあるようにする。必須/任意、既定値、
  用途を実装から写す。
- `.env.example` と configuration.md の変数集合に差分がないことを突合し、結果を validation
  に添付する。
- `:61` の「exact Zod-schema inventory」という主張を維持するなら、それが事実になるようにする。
  維持できないなら主張自体を弱める。
- ついでに見つけた失効記述（例: ADR-0016 受理済みなのに「deployment-platform ADR 待ち」と
  書いてある箇所）があれば現状に合わせて直す。**ただし実装予定日や実装約束は書かない。**

## 判断が必要になったら

文言調整は裁量範囲。ただし次は**推測せず `status=blocked`**。

- 文書にあるが実装に無い変数を見つけた場合。**実装を文書に合わせて変更してはならない。**
- ADR / DEC / plans の決定内容を書き換える必要が生じた場合

## 品質要件

- `mise run ci` green（PR #125 以降、実 PostgreSQL が必須。`mise run db:require` が手順を表示する）
- crit CLI で自己レビュー（resolved まで）
- push → PR（base=main、`ai-generated` ラベル）→ checks green → AGMSG-RESULT
- **merge は人間レビュアーのみ**（ADR-0006）

## 完了条件

- [ ] `config.ts` の Zod スキーマ変数がすべて configuration.md に存在する
- [ ] configuration.md と `.env.example` の変数集合に差分がない（突合結果を validation に添付）
- [ ] `mise run ci` exit 0

## forbidden_actions

- `allowed_files` 以外の編集（**実装コードの変更は一切行わない**）
- **`AGENTS.md` の編集**（当初の指摘は誤りで撤回済み）
- ADR / DEC / plans の決定内容の書き換え、未実装機能の実装予定日の記載
- merge-before-acceptance、`docs/audit/` 配下の編集

## allowed_files

```
docs/reference/configuration.md
```

## 完了報告

```
AGMSG-RESULT v1 task_id=A025 status=ready_for_review|blocked report=.orchestration/reports/A025-report.md validation=.orchestration/validation/A025-validation.md sandbox=.orchestration/sandboxes/A025-sandbox.md learning=.orchestration/learning/A025-learning.md autoskill=.orchestration/autoskill/runs/A025-autoskill.md
```
