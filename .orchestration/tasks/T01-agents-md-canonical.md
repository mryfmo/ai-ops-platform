# T01: AGENTS.md を正本化し CLAUDE.md を @AGENTS.md 参照にする

## Objective

現在は `CLAUDE.md` が規約の正本で、`AGENTS.md` が要約エイリアスになっている。これを反転する:

1. `AGENTS.md` — 現 `CLAUDE.md` の全文(開発ガイド全体)をここに移す。正本は AGENTS.md であることが分かるよう冒頭の文言を調整する:
   - タイトルは「# ai-ops-platform 開発ガイド(AI コーディングエージェント向け)」のままでよい
   - 「このファイルは … 規約の正本である(AGENTS.md は同内容のエイリアス)」の一文を、「このファイル(AGENTS.md)が規約の正本である。CLAUDE.md は `@AGENTS.md` によるインポートのみを含む」という趣旨に書き換える
   - 現 AGENTS.md にある「要点(詳細は CLAUDE.md 参照)」の要約セクションは不要(全文が入るため削除)
   - それ以外の本文(コマンド体系・パッケージ構成・設計原則・テスト規約・schema.sql 変更手順・Git/PR 規約・参照ドキュメント)は現 CLAUDE.md から内容を変えずに引き継ぐ
2. `CLAUDE.md` — 中身を次の 1 行だけにする(Claude Code のインポート構文):

   ```
   @AGENTS.md
   ```

## Repo

- repo: `/Users/mryfmo/Workspace/ai-ops-platform`(実体は `/Users/mryfmo/Workspace/.mryfmo-tmp` の sparse clone 内サブディレクトリ。symlink 経由で作業してよい)
- 作業ブランチは切らない。working tree の変更のみ。**git commit / push / branch 操作は禁止**

## Allowed files

- `/Users/mryfmo/Workspace/ai-ops-platform/AGENTS.md`
- `/Users/mryfmo/Workspace/ai-ops-platform/CLAUDE.md`
- `.orchestration/` 配下の本タスクの成果物ファイル

上記以外のファイル編集は禁止。

## Forbidden actions

- git commit / push / branch / tag
- 依存関係の追加・変更、パッケージインストール
- AGENTS.md / CLAUDE.md 以外のリポジトリファイルの編集
- ネットワークアクセスを伴うコマンド(git fetch/pull 含む)
- LLM API 呼び出し

## Expected artifacts

- report: `.orchestration/reports/T01-report.md` — 何をどう変えたかの短い報告
- validation: `.orchestration/validation/T01-validation.txt` — 以下のコマンド出力を貼る:
  - `cat CLAUDE.md`(`@AGENTS.md` の 1 行のみであること)
  - `head -10 AGENTS.md`
  - `git -C /Users/mryfmo/Workspace/.mryfmo-tmp status --short`(変更が `ai-ops-platform/AGENTS.md` と `ai-ops-platform/CLAUDE.md` の 2 件のみであること)
- sandbox: `.orchestration/sandboxes/T01-sandbox.md` — sandbox 不使用ならその旨 1 行
- learning: `.orchestration/learning/T01-learning.md` — 再利用可能な学びがなければ「none」
- autoskill: `.orchestration/autoskill/runs/T01-autoskill.md` — 不使用なら not-used 記録

## Done signal

`AGMSG-RESULT v1 task_id=T01 status=ready_for_review report=... validation=... sandbox=... learning=... autoskill=...` を team `ai-ops-platform` で `orchestrator-fable5` 宛に送信:

```sh
~/.agents/skills/agmsg/scripts/send.sh ai-ops-platform codex-gpt55-high orchestrator-fable5 '<AGMSG-RESULT ...>'
```

max_turns: 10
