# ADR-0012: AIエージェント報告はCIからheadless生成し共通スキーマで標準化する

## ステータス

採用

## コンテキスト

- ADR-0006はClaude Code / Droidをコーディングタスク実行・可視化に統合する方針を採用した。
- `docs/research/2026-07-09-agent-standardization.md` は、Claude Codeでは `claude -p --bare --output-format json --json-schema` により構造化出力を強制できる一方、Droid/Factoryの `droid exec -o json` は内容スキーマ検証ではないことを確認している。
- 同調査は、Claude Code structured outputsでは `maxLength` が強制できず、Droidにも同等の文字数強制機構がないため、スロット文字数上限はリポジトリ側コードで検証する必要があると整理している。
- 予定仕様ID: PrjOps `REQ-040` / `SPEC-INT-067` / `AC-040-1`、DevOps `REQ-032` / `SPEC-INT-082` / `AC-032a`。実装コード参照を追加しない本ADR段階では、`REQ`/`SPEC-INT` のspec-id登録は実装フェーズへ送る。

## 決定

- 標準報告はCI（GitHub Actions）からのheadless生成のみを正規経路とする。対話セッションで生成した文章は標準報告として扱わない。
- Claude Codeは `claude -p --bare --output-format json --json-schema` で実行する。ただしLLMに渡すスキーマは文章スロット専用であり、数値・根拠ID・reportType・periodLabelはCI側のコードで算出・注入する。
- Droidは `droid exec -o json` で実行し、リポジトリ側で文章スロットJSONを検証する。最終報告JSONは `finalizeReportJson` がCI内で組み立てる。
- スロット文字数の上限は両プラットフォームともスキーマだけでは強制できないため、CIの最終化ステップで検証、必要時の決定的切詰め、監査ファイル出力を行う。
- 報告テンプレートとスキーマは共通ソース1箇所に置く。`.claude/skills` と `.factory/droids` / `.factory/skills` は、その共通ソースを参照する薄い入口に限定する。

## 根拠

- `--bare` はユーザー個別のhooks/skills/メモリ混入を避け、CIで同じ結果を得るための公式経路である。
- Factoryはproject定義がpersonal定義を上書きするが、`~/.factory/AGENTS.md` やhooksの混入を完全には避けられない。標準報告をCIに限定する方が差分を管理しやすい。
- 報告形式を各エージェントのプロンプトに重複定義すると、セクション追加や文量変更のたびに複数箇所がずれる。共通ソース方式の方が保守面積が小さい。

## 影響

- 標準報告用のGitHub Actionsと、Claude Code / Droidの実行アダプタが必要になる。
- `.claude/skills`、`.factory/droids`、`.factory/skills` は生成物または薄い参照層として扱う。
- 文字数超過時の扱いは、リトライ後も収まらなければ決定的に切り詰める。切詰めは監査ログに残す。
- Droid出力は `-o json` の外形だけで合格にせず、必ずリポジトリ側スキーマ検証を通す。
