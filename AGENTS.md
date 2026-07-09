# ai-ops-platform 開発ガイド（AGENTS.md）

このファイルは **CLAUDE.md と同一内容を指すエイリアス**である。Droid（Factory）等、
AGENTS.md を規約ファイルとして参照するAIコーディングエージェントはこちらを起点に読むこと。

規約の正本: [CLAUDE.md](./CLAUDE.md)

要点（詳細はCLAUDE.md参照）:

1. **DoD**: `mise run ci` green（lint→format→typecheck→build→test→traceability）
2. **lib/=純粋関数、agents/=結線層** の分離を崩さない
3. **数値はコード算出、LLMは文章/表示パラメータのみ**
4. 新規ファイルに**根拠IDヘッダ**（REQ/SPEC-INT/TH/AC/ADR）必須
5. 秘密情報は保存前・LLM入力前・出力前の**3箇所でサニタイズ**
6. 監査ログは**追記専用**、権限フィルタは**データ取得側で強制**
7. mainへ直接pushしない。AIエージェントのPRは `agent/{task-id}` ブランチ + `ai-generated` ラベル、**マージは人間のみ**
