# T07: Phase I4 — AI エージェント報告の標準化基盤(ADR-0012 実装)

## Objective

ADR-0012(PR #3 の `docs/adr/0012-agent-report-standardization.md`。未マージだが設計は確定済み — 内容は agent/T06 ブランチか `.orchestration/research/2026-07-09-agent-standardization.md` を参照)に基づき、Claude Code / Droid の両方で同一粒度・同一形式・同一文量の報告を生成する基盤を実装する。

## スコープ(この順で)

1. **共通報告スキーマ/テンプレートソース** — `packages/shared/src/reporting/` を新設:
   - 報告スキーマ(JSON Schema): 固定セクション構造、必須スロット、スロット毎の maxChars 定義(スキーマ自体では強制できないためメタデータとして保持)
   - スロット文字数の検証・切詰め・リトライ: 既存 `anthropicClient.ts` の forced tool_choice パターンを拡張するラッパー(`generateReportSlots()` 等)。検証失敗時は 1 回リトライ → 切詰め、監査ログに記録
   - 根拠 ID ヘッダ必須。lib 純粋関数(検証ロジック)と結線(LLM 呼び出し)を分離
2. **薄い入口** — `.claude/skills/generate-report/SKILL.md` と `.factory/droids/report-generator.md` + `.factory/skills/generate-report/SKILL.md` を新設。いずれも共通ソースのスキーマ/テンプレートを参照するだけの薄い定義とし、報告内容の規定を重複させない
3. **CI からの headless 生成経路** — `.github/workflows/report-generation.yml`(workflow_dispatch + スケジュール雛形): Claude Code 経路は `claude -p /generate-report --bare --output-format json --json-schema <共通スキーマ>`、Droid 経路は `droid exec -f <プロンプト> -o json` + 後段のスキーマ検証ステップ(共通ソースの検証 CLI を呼ぶ)。既存 `.github/actions/run-coding-agent` の claude-code|droid スイッチの流儀に合わせる
4. **動作例 1 本** — 週次サマリー報告テンプレート(数値スロットはコード算出値を注入、LLM は結論文スロットのみ)を既存 prjops の reportShell/profileReports と整合する形で追加し、モックでテスト
5. **仕様 ID 登録** — ADR-0012 記載の予定 ID(PrjOps REQ-040/SPEC-INT-067/AC-040-1、DevOps SPEC-INT-082/AC-032a)を spec-ids に登録し、実装・テストから参照して traceability を通す(既存 ID と衝突する場合は末尾採番でずらし、report に記載)

## Repo / 規約

- ブランチ `agent/T07` を **main から**作成(agent/T05・T06 からではない。spec-ids で PR #3 と競合し得る点は許容 — マージ順で解決)
- AGENTS.md 全規約: lib/agents 分離、3 箇所サニタイズ、監査ログ追記専用、テスト必須(describe/it に仕様 ID)
- DoD: `mise run ci` green(並列レースに当たる場合は `mise run -j 1 ci` で green を確認し、その旨を validation に記録)
- pnpm install が必要な場合: `mise exec -- pnpm install --network-concurrency 1 --fetch-retries 5 --fetch-retry-mintimeout 20000 --fetch-timeout 120000`(レジストリタイムアウト対策)
- Conventional Commits、PR 作成(`ai-generated` ラベル)、マージ禁止、`.orchestration/` は commit しない

## Forbidden actions

- 依存関係の追加(既存依存のみ。スキーマ検証は自前実装か既存依存で)
- main への push、PR マージ、force push
- 他フェーズ(ダッシュボード・Excel・Seven Keys 刷新)の先取り実装
- 実 LLM API 呼び出し(テストはモック)

## Expected artifacts(絶対パス)

- report: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/reports/T07-report.md`
- validation: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/validation/T07-validation.txt` — `mise run ci`(または -j 1)末尾、`git show --stat HEAD`、`gh pr view --json url,labels`
- sandbox / learning / autoskill: 同ディレクトリ T07-\*.md

## Done signal

```sh
~/.agents/skills/agmsg/scripts/send.sh ai-ops-platform codex-gpt55-high orchestrator-fable5 'AGMSG-RESULT v1 task_id=T07 status=ready_for_review report=... validation=... sandbox=... learning=... autoskill=...'
```

max_turns: 40
