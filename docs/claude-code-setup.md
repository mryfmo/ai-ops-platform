# Claude Code 開発環境セットアップ（settings.json / hooks）

`.claude/settings.json` と自動実行フック（PostToolUse typecheck）は、エージェントの権限・自動動作を
変更する設定のため**エージェント自身は書き込まない**。以下の内容を確認のうえ、開発者自身が
`.claude/settings.json` として保存して有効化すること。

## 1. `.claude/settings.json`（推奨内容）

```json
{
  "permissions": {
    "allow": [
      "Bash(mise run:*)",
      "Bash(mise install:*)",
      "Bash(pnpm install:*)",
      "Bash(pnpm run:*)",
      "Bash(pnpm --filter:*)",
      "Bash(pnpm -r:*)",
      "Bash(pnpm exec tsx:*)",
      "Bash(pnpm exec vitest:*)"
    ],
    "deny": ["Read(.env)", "Read(.env.*)", "Read(**/.env)", "Read(**/.env.*)"]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "node .claude/hooks/guard-write.mjs" }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "node .claude/hooks/typecheck-after-edit.mjs", "timeout": 150 }]
      }
    ]
  }
}
```

- **permissions.allow**: mise/pnpm系コマンドを許可プロンプトなしで実行可能にする（DoD検証の高速化）
- **permissions.deny**: `.env*` の読取をエージェントから遮断（REQ-030の開発環境側防御）
- **PreToolUse hook**: `dist/`・`.env*`・`pnpm-lock.yaml` への直接書込をブロック、schema.sql編集時に
  db-migrationスキル手順をリマインド（`.claude/hooks/guard-write.mjs` はリポジトリに同梱済み）
- **PostToolUse hook**: `.ts/.tsx` 編集後に該当パッケージのみtypecheckを実行し、
  失敗をエージェントへ即時フィードバック

## 2. `.claude/hooks/typecheck-after-edit.mjs`（手動作成）

```javascript
// PostToolUse(Edit|Write on *.ts/*.tsx): 編集したパッケージのみ typecheck を実行
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const input = JSON.parse(readFileSync(0, "utf8"));
const p = String(input?.tool_input?.file_path ?? "").replace(/\\/g, "/");

const m = p.match(/packages\/([^/]+)\/.*\.(ts|tsx)$/);
if (!m) process.exit(0);

const pkgName = `@aiops/${m[1]}`;

try {
  execSync(`pnpm --filter ${pkgName} run typecheck`, {
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
    encoding: "utf8",
  });
  process.exit(0);
} catch (err) {
  const out = `${err.stdout ?? ""}${err.stderr ?? ""}`.slice(0, 4000);
  console.error(`typecheck失敗 (${pkgName}):\n${out}`);
  process.exit(2); // exit 2 = エージェントにエラーを返す
}
```

## 3. Droid（Factory）側

Droidは `AGENTS.md` を自動参照する。追加設定が必要な場合は Factory 側の設定画面で
リポジトリルールとして `AGENTS.md` を指定する。

## 4. 確認方法

1. `.claude/settings.json` 保存後、Claude Code を再起動（またはセッション再開）
2. `mise run typecheck` を依頼し、許可プロンプトが出ないこと
3. `dist/` 配下への書込を依頼し、フックがブロックすること
