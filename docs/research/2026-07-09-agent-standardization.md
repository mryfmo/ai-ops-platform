# 補完調査: Claude Code / Droid 報告標準化メカニズム (2026-07-09)

一次ドキュメント検証済み。Phase D / Phase I4 の設計材料。

## 結論(要件 → メカニズム対応)

| 要件                     | Claude Code                                                                                                                                            | Droid/Factory                                                                                                                                  | 帰結                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 同一形式(セクション構造) | `claude -p --json-schema` で structured_output をハード検証可。Stop/PostToolUse hook (exit 2) で不適合を差し戻し可                                     | カスタム droid の本文でテンプレート固定(プロンプトレベルのみ)。droid exec にスキーマフラグなし                                                 | CC はハード強制可、Factory はリポジトリ側コードで検証必須                                 |
| 同一文量                 | **スキーマでは不可** — structured outputs は minLength/maxLength 非対応(SDK は description に降格)                                                     | なし                                                                                                                                           | **両方ギャップ** → 既存 anthropicClient ラッパーにスロット毎の文字数検証+リトライを実装   |
| ユーザー非依存           | `claude -p --bare`(hooks/skills/CLAUDE.md の自動探索をスキップ、全マシン同一)。**罠: 対話セッションでは personal skill が project skill を同名上書き** | project droid は personal を上書き(良)。**罠: `~/.factory/AGENTS.md` の personal override と `~/.factory/hooks.json` が混入、--bare 相当なし** | **標準報告はパイプライン生成のみ(CI の headless 実行)とし、対話セッションで生成させない** |
| CI 生成                  | `claude -p /report-skill --bare --output-format json --json-schema ...`(GitHub Actions)                                                                | `droid exec -f prompt.md -o json --auto low`(cookbook あり、中身は未検証エンベロープ)                                                          | 両方スクリプト可、内容検証は CC のみ                                                      |

## 設計原則(Phase I4)

1. **報告の数値・構造はコード算出、LLM は文章スロットのみ** — 既存設計と完全整合。スロット文字数の上限検証・切り詰め・リトライをリポジトリ側ラッパーに追加する。
2. **標準報告はワークフロー(GitHub Actions)から headless 生成** — Claude Code は `--bare + --json-schema`、Droid は `droid exec -o json` + リポジトリ側スキーマ検証を通す。ユーザーの対話セッションは標準報告の生成経路にしない。
3. スキル配置: Claude Code は `.claude/skills/`(ただし対話では personal が同名上書きし得る)、Factory は `.factory/skills/`+`.factory/droids/`(project が勝つ)。両対応のテンプレート/スキーマは共通ソース(例 `packages/shared` か `templates/`)に置き、スキルはそれを参照するだけにする。
4. AGENTS.md: Factory はネイティブ読込(近い方優先、`~/.factory/AGENTS.md` が personal override)。Claude Code は CLAUDE.md 経由(`@AGENTS.md` インポート — 本リポジトリは適用済み)。

## 主要な逐語事実

- Claude Code 構造化出力: minLength/maxLength・minimum/maximum は非対応(明記)。`strict: true` の tool use はツール名と入力のスキーマ検証を保証。
- `--bare`: "useful for CI and scripts where you need the same result on every machine"。将来 `-p` のデフォルト化予定。
- Claude Code skills 優先順位: "enterprise overrides personal, and personal overrides project"(対話時の同名シャドーイングに注意)。
- Factory custom droids: "Project definitions override personal ones when the names match"。
- Factory AGENTS.md 探索順: cwd → 親 → サブフォルダ → `~/.factory/AGENTS.md`(personal override)。
- droid exec: `-o json` はパース用エンベロープであり内容のスキーマ検証ではない。Stop hook による継続強制も文書化なし。

## ソース

code.claude.com/docs/en/{skills,memory,hooks,output-styles,headless,settings}、platform.claude.com/docs/en/build-with-claude/structured-outputs、docs.factory.ai/cli/{configuration/custom-droids,configuration/agents-md,configuration/skills,configuration/custom-slash-commands,configuration/hooks-guide,droid-exec/overview,droid-exec/cookbook/github-actions}、docs.factory.ai/reference/cli-reference
