# T03: ai-ops-platform を独立リポジトリ化し、.mryfmo-tmp と symlink を撤去する

## Objective

`mryfmo/tmp` のサブディレクトリに仮置きされている ai-ops-platform を、履歴を保持したまま独立リポジトリ `mryfmo/ai-ops-platform`(private)に昇格させる。`~/Workspace/ai-ops-platform` を通常の clone に置き換え、回避策だった `~/Workspace/.mryfmo-tmp`(sparse clone)と symlink を撤去する。

前提(確認済み): tmp のルートは README.md と ai-ops-platform/ のみ。`mryfmo/ai-ops-platform` は未使用。tmp は private。PR https://github.com/mryfmo/tmp/pull/2(branch `agent/T01`、AGENTS.md 正本化)が OPEN。

## 手順

作業領域: `SCRATCH=/private/tmp/claude-501/-Users-mryfmo/bba94862-bb02-4aac-afc3-f9c0fa8818ec/scratchpad`

1. フル clone(subtree split には全履歴が必要。既存 sparse clone は使わない):
   `git clone https://github.com/mryfmo/tmp "$SCRATCH/tmp-full"`
2. `git -C "$SCRATCH/tmp-full" fetch origin agent/T01` してから、AGENTS.md 変更込みで履歴を切り出す:
   `git -C "$SCRATCH/tmp-full" subtree split --prefix=ai-ops-platform origin/agent/T01 -b ai-ops-main`
3. 新リポジトリ作成(private、clone しない): `gh repo create mryfmo/ai-ops-platform --private`
4. push: `git -C "$SCRATCH/tmp-full" push https://github.com/mryfmo/ai-ops-platform.git ai-ops-main:main`
5. `~/Workspace/ai-ops-platform`(symlink)を撤去: `rm /Users/mryfmo/Workspace/ai-ops-platform`(symlink 単体の rm。rm -rf は使わない。拒否されたら `mv` で `$SCRATCH/.trash/` へ退避)
6. 新リポジトリを clone: `git clone https://github.com/mryfmo/ai-ops-platform.git /Users/mryfmo/Workspace/ai-ops-platform`
7. オーケストレーション記録を新 clone に引き継ぐ(commit はしない):
   - `cp -R /Users/mryfmo/Workspace/.mryfmo-tmp/ai-ops-platform/.orchestration /Users/mryfmo/Workspace/ai-ops-platform/.orchestration`
   - `cp -R /Users/mryfmo/Workspace/.mryfmo-tmp/.orchestration/. /Users/mryfmo/Workspace/ai-ops-platform/.orchestration/`(T02/T03 成果物のマージ。上書き衝突があれば報告に記載)
8. `.mryfmo-tmp` を退避(rm -rf 禁止): `mv /Users/mryfmo/Workspace/.mryfmo-tmp "$SCRATCH/.trash/mryfmo-tmp"`
9. PR #2 を閉じる(マージはしない):
   `gh pr close 2 --repo mryfmo/tmp --comment "Superseded: ai-ops-platform was promoted to standalone repo mryfmo/ai-ops-platform via git subtree split from agent/T01; this change is included in its main."`

## Forbidden actions

- `mryfmo/tmp` リポジトリの削除・アーカイブ・main への push、PR #2 のマージ
- `rm -rf` の使用(撤去はすべて `mv` で scratchpad の `.trash/` へ)
- `~/Workspace` 配下の他のエントリへの変更
- 新リポジトリへの force push(初回 push を除き不要のはず)
- ファイル内容の改変(履歴切り出しと配置替えのみ。コードや docs は変更しない)
- LLM API 呼び出し

## Expected artifacts(絶対パスで作成)

- report: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/reports/T03-report.md` — 新リポジトリ URL、main 先頭 SHA、実施手順の要約、衝突・逸脱があれば記載
- validation: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/validation/T03-validation.txt` — 以下の出力:
  - `git -C /Users/mryfmo/Workspace/ai-ops-platform log --oneline | head -5`(履歴が保持され、先頭付近に AGENTS.md canonical の commit があること)
  - `git -C /Users/mryfmo/Workspace/ai-ops-platform remote -v`
  - `cat /Users/mryfmo/Workspace/ai-ops-platform/CLAUDE.md`(`@AGENTS.md` の 1 行)
  - `ls -d /Users/mryfmo/Workspace/.mryfmo-tmp`(存在しないこと=エラー出力)
  - `test -L /Users/mryfmo/Workspace/ai-ops-platform && echo symlink || echo real-dir`(real-dir であること)
  - `gh pr view 2 --repo mryfmo/tmp --json state`(CLOSED)
- sandbox: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/sandboxes/T03-sandbox.md` — 不使用なら 1 行
- learning: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/learning/T03-learning.md` — なければ「none」
- autoskill: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/autoskill/runs/T03-autoskill.md` — 不使用なら not-used 記録

## Done signal

```sh
~/.agents/skills/agmsg/scripts/send.sh ai-ops-platform codex-gpt55-high orchestrator-fable5 'AGMSG-RESULT v1 task_id=T03 status=ready_for_review report=... validation=... sandbox=... learning=... autoskill=...'
```

max_turns: 15
