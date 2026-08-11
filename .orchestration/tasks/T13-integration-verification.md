# T13: Phase V — 統合検証(E2E)と検証報告の更新

## Objective

T05〜T12 で構築した全機能を、スタック最上段 `agent/T12` 相当のコードベースで実際に起動・駆動して end-to-end 検証し、`verification/VERIFICATION_REPORT.md` を現状に合わせて更新する。テストが通ることの再確認ではなく、**実際に動くことの観測**が目的。

## ブランチ戦略

- `agent/T13` を `agent/T12` から作成、PR base は `agent/T12`(修正・ドキュメント更新の commit 用。検証のみで差分が出ない項目は report に記録)

## 検証項目(実行できるものは実行し、証跡を validation に貼る)

### 1. Web ダッシュボード実起動

- `packages/web` を build して起動(dev または standalone)。認証は開発モードの流儀(authGuard の dev/test 経路)に従う
- 実ブラウザ相当の確認が難しい場合は、`next start` + curl で各ページ/API を叩き、HTML/JSON の実応答を検証:
  - `/dashboard` が 200 でレンダリングされること
  - `/api/data/{executive-summary,manager-summary,investor-summary,timeseries,projects,agent-activity}` がサンプルデータで正しい JSON 構造を返すこと(期間 week/month/quarter/half/year の切替を含む)
  - `/api/chat` がモック LLM(実 API キーなし)でエラーハンドリング込みの応答をすること。**ANTHROPIC_API_KEY が環境にあれば実 LLM で 1 往復だけスモーク**(ページエージェントが reasoning parts と tool call を返すこと)し、なければ「要実環境」と記録
- コンソール/サーバログにエラーが出ないこと

### 2. server 実起動スモーク

- PostgreSQL が必要。ローカルで用意できる場合(既存 postgres、または docker が使えるなら `docker run postgres`)は schema.sql を適用して起動し、`/healthz` `/readyz` を確認、xlsx-import の template/dry-run ルートを実ファイルで叩く(サンプル .xlsx は T08 の CLI で生成し、数行埋めて dry-run のエラーレポートと正常系を確認)
- DB が用意できない場合は起動不能の旨と必要手順を記録し、app.request ベースの統合テストで代替した範囲を明記

### 3. Excel インポート E2E(モック GitHub)

- テンプレート生成 → 記入 → パース → dry-run レポート → (モック GitHub クライアントで)実行 → 台帳記録 → 再実行で全件スキップ、の一連をスクリプトで通し、出力を validation に貼る

### 4. 標準報告パイプライン

- `packages/shared` の報告スキーマ検証 CLI に不正/適合 JSON を通し、エラーレポートと成功を確認
- `claude -p` / `droid exec` の実行はローカル環境にある場合のみスモーク(なければ「CI 実行前提」と記録)

### 5. 検証報告とドキュメント更新

- `verification/VERIFICATION_REPORT.md` を更新: 新機能(時系列基盤/期間ダッシュボード/Seven Keys 正典/投資家ペルソナ/DORA5/Excel インポート/報告標準化/ビジュアル刷新/ページエージェント)ごとに「検証方法・結果・実環境で未検証の残項目(org webhook 設定、GitHub App 権限、Teams、実 LLM キー等)」を表で記録
- README.md の機能概要を現状に追随(過剰な書き換えはしない)
- 発見した不具合は**このタスク内で修正**し(根本対処)、修正内容を report に記載。修正が大きい場合は blocked で報告し判断を仰ぐ

## 規約

- DoD: 並列 `mise run ci` green + 上記検証の証跡。Conventional Commits、PR(`ai-generated`、base=agent/T12)、マージ禁止、`.orchestration/` は commit しない
- 依存追加なし。危険な操作(docker 等)はサンドボックス外実行の承認を求めてよい

## Forbidden actions

- 依存追加、main への push、PR マージ、force push
- 実 GitHub への書込(インポート実行はモックのみ。読み取り系 API の確認は可)
- 検証で見つけた問題の隠蔽・先送り(必ず修正するか blocked で報告)

## Expected artifacts(絶対パス)

- report: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/reports/T13-report.md`
- validation: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/validation/T13-validation.txt`
- sandbox / learning / autoskill: 同ディレクトリ T13-\*.md

## Done signal

```sh
~/.agents/skills/agmsg/scripts/send.sh ai-ops-platform codex-gpt55-high orchestrator-fable5 'AGMSG-RESULT v1 task_id=T13 status=ready_for_review report=... validation=... sandbox=... learning=... autoskill=...'
```

max_turns: 60
