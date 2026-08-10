# ADR-0002: Claude API利用の使い分け（Messages API vs Agent SDK）

## ステータス

採用

## コンテキスト

- PrjOps SPEC-INT-001 は「LLMを使う処理は(a)自由文の構造化(AGT-02) (b)レポート要約文生成(AGT-04)
  (c)重要度引き上げ提案の理由文生成(AGT-03) の3つに限定する」「決定的処理はLLMを使わず純粋関数」と明記。
- DevOps SPEC-INT-063 は「分類・要約はClaude API（構造化JSON出力）、コード修正案はClaude Code
  （read-onlyワークスペース）」と明記。
- 2026年7月時点で、Anthropicは用途に応じて2つの異なるSDKパッケージを提供している
  （出典: `docs.claude.com`, `platform.claude.com`）。
  - `@anthropic-ai/sdk`: 素のMessages API呼び出し（`client.messages.create`）。
  - `@anthropic-ai/claude-agent-sdk`（旧称 Claude Code SDK。2025年後半に改称）:
    Claude Codeのツール実行ループ（ファイル読み書き・Bash実行等）をプログラムから利用するためのSDK。

## 決定

- **構造化データ抽出・分類・要約・理由文生成**（自由文の構造化、ビルド失敗分類、インシデント分類、
  重要度引き上げ理由文、差分要約、経営陣向け結論文）は、すべて `@anthropic-ai/sdk` の
  Messages APIを、**ツール強制（`tool_choice: {type:"tool", name:...}`）**方式で呼び出す
  （`packages/shared/src/clients/anthropicClient.ts`）。この方式は自由文からのJSON抽出よりも
  パース失敗率が低く、決定的なスキーマ検証と組み合わせやすい。
- Messages API の既定モデルは `claude-sonnet-4-6` に意図的にピンする。2026-07-10時点の
  Anthropic公式ドキュメントではより新しい `claude-sonnet-5` が存在するが、Sonnet 5 へ移行すると
  manual extended thinking と非既定サンプリングパラメータの扱いが変わるため、モデル移行は別タスクで
  互換性検証と一緒に行う。
- 自由文構造化のエスカレーション先 `claude-opus-4-8` では、Anthropic公式 migration guide に従い
  非既定 `temperature` / `top_p` / `top_k` を送らない。`claude-sonnet-4-6` の通常構造化呼び出しは
  従来どおり `temperature: 0` を維持する。
- **コード修正案の生成**（DevOps AGT-BLDのみ）は `@anthropic-ai/claude-agent-sdk` の`query()`を
  使用し、read-only権限（`allowedTools`を`Read`/`Grep`/`Glob`のみに限定、`disallowedTools`で
  `Write`/`Edit`/`Bash`等を明示的に禁止、さらに`canUseTool`フックで多層防御）で実行する
  （`packages/shared/src/clients/claudeAgentClient.ts`）。これによりREQ-002 AC-002b
  「修正案がリポジトリへ自動コミット・自動マージされないこと」を、書き込み系APIを一切呼ばない
  設計そのもので保証する。

## 根拠

- 「決定的処理はLLMを使わない」という設計原則を守るため、LLM呼び出しの範囲をできるだけ狭く、
  かつ出力形式を厳密に固定する必要がある。ツール強制はAnthropic公式が推奨する構造化出力の
  確立されたパターンである。
- コード修正案生成だけはClaude Codeの持つファイル読解・複数ファイル横断理解の能力が必要であり、
  単純なMessages API呼び出しでは代替しにくい。一方で自動コミットは仕様で明確に禁止されているため、
  権限モデルレベルでの多層防御が必須である。

## 影響

- `@anthropic-ai/sdk`と`@anthropic-ai/claude-agent-sdk`の両方がpackage.jsonの依存関係になる。
- Agent SDKのオプション名（`allowedTools`/`disallowedTools`/`canUseTool`等）はSDKのバージョンにより
  変更される可能性があるため、`claudeAgentClient.ts`冒頭に「導入時に最新リファレンスで再確認する」
  旨を明記している。

## Amendment（2026-08-10、P0-T03）

ADR-0022（Proposed）が provider 接続経路（direct Anthropic credential / provider selection）を段階的に置換する。構造化出力・決定的ロジック分離の原則は維持。
最終アーキテクチャ計画: docs/plans/2026-08-final-architecture/（PR #152、Owner 承認済み baseline-delta 適用）。
