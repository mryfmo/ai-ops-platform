# A003: Plan 013 Phase 0 — ADR-0018 収載と README 正規登録(P013-F00-T02/T03 + PR 準備)

- task_id: A003
- repo: /Users/mryfmo/Workspace/ai-ops-platform(作業は worktree /private/tmp/ai-ops-platform-A001)
- 発行: orchestrator-fable5 (2026-07-18)
- 担当: codex-gpt56sol-high
- max_turns: 25
- 根拠: plans/013-page-agent-pptx-parity.md P013-F00-T02/T03/T04(T01 drift check は orchestrator が PASS 済み → .orchestration/validation/A003-driftcheck.md)

## 前提手順

1. worktree で `agent/A002-plan012-resync`(56c74ec)から stacked branch `agent/p013-f00-decision` を作成(Plan 013 指定のブランチ名)。

## 作業内容

1. **Planned at 記入**(T01 の残作業、orchestrator 提供値):
   plans/013-page-agent-pptx-parity.md の `Planned at` 行に `017f609b0274007178f8796d6142bbce990465fe` を記入。
   ※ この plan ファイル自体は primary repo の untracked。primary の実体は編集せず、worktree へコピーして
   ブランチに新規追加し、そのコピーへ記入する(primary 側は不変のまま)。
2. **T02: ADR-0018 収載**: primary の untracked `plans/0018-page-agent-architecture.md` の本文を無改変で
   `docs/adr/0018-page-agent-architecture.md` として新規配置(ステータス「提案」のまま)。
   Verify: 5節構成(ステータス/コンテキスト/決定/根拠/影響)と仕様ID6件の `###` アンカー存在、Prettier check。
3. **T03: README 正規登録**: plans/README.md を plan 正規の内容へ:
   (a) 013 行を正規 title「内部ページエージェントを全ペルソナで動かしalibaba/page-agent不採用を確定する」へ置換
   (b) Current notes へ「Plan 013: ADR-0018の範囲のみ。projectBoardデータ経路はPlan 010の領分で、公開ゲートの `true` 化はPlan 010成果到達後の作業」を1行追加
   (c) A001 が暫定追加した 0018 擬似行を削除(ADR が docs/adr へ正規収載されるため)
4. `MISE_LOCKED=1 mise run format` と `MISE_LOCKED=1 mise run ci` を green に。
5. crit CLI 自己レビュー(resolved 記録まで)。
6. docs-only Conventional Commit(1〜2個、例: docs(adr): adopt ADR-0018 as proposed / docs(plan013): register plan and planned-at)。
7. push + draft stacked PR 作成(base=agent/A002-plan012-resync、ai-generated ラベル、dev-phase token 免除注記)。
   PR 本文に: OSS(alibaba/page-agent)不採用の要旨、会話監査保存が増えるデータ影響、
   Open Questions TBD(HUMAN)-1 の承認依頼、0018 擬似行削除の説明(T04 要件)。
   ※ ADR ステータスの「採用」化と merge は owner 承認後の別作業。行わない。

## allowed_files

- docs/adr/0018-page-agent-architecture.md(新規)
- plans/013-page-agent-pptx-parity.md(worktree への新規追加 + Planned at 行のみ)
- plans/README.md(013 行置換・note 追加・0018 擬似行削除のみ)
- .orchestration/reports/A003-report.md
- .orchestration/validation/A003-validation.md
- .orchestration/sandboxes/A003-sandbox.md
- .orchestration/learning/A003-learning.md
- .orchestration/autoskill/runs/A003-autoskill.md

## forbidden_actions

- 製品コード・テスト・schema・依存関係の変更
- ADR 本文の改変(無改変配置。ステータス「採用」化も禁止 = owner 承認後)
- 既存 ADR(0001〜0016)の編集、0017 の採番
- primary repo の untracked ファイルの変更・移動・削除
- merge、force-push、main への push
- worklog・docs/audit の編集、LLM API 呼び出し
- ブラウザ Crit、ユーザーへのレビュー依頼

## 完了報告

```
AGMSG-RESULT v1 task_id=A003 status=ready_for_review|blocked report=.orchestration/reports/A003-report.md validation=.orchestration/validation/A003-validation.md sandbox=.orchestration/sandboxes/A003-sandbox.md learning=.orchestration/learning/A003-learning.md autoskill=.orchestration/autoskill/runs/A003-autoskill.md
```

report には PR URL、コミット SHA、T02/T03 の verify 結果を含める。
