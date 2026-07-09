---
name: add-traced-module
description: 根拠IDヘッダ付きのlib純粋関数モジュールとvitestテストの雛形を生成する。新しい判定ロジック・スコアリング・バリデーション関数を追加するとき、traceability検証を通る形で作成する場合に使用。
---

# add-traced-module: 根拠ID付きモジュール雛形の生成

## 手順

1. 引数から以下を確定する（不足があればユーザーに確認）:
   - 対象パッケージ（shared / prjops / devops / server / web）
   - モジュール名（camelCase、例: `deployWindowRule`）
   - 根拠となる仕様ID（REQ-xxx / SPEC-INT-xxx / TH-xxx / AC-xxx / ADR-xxxx のいずれか1つ以上）
   - 関数の責務（1文）

2. `packages/{pkg}/src/lib/{module}.ts` を以下の形式で作成する:

```typescript
/**
 * packages/{pkg}/src/lib/{module}.ts
 *
 * 根拠:
 *   - {仕様ID}: 「{仕様の該当文言の引用}」
 *
 * 設計方針: 純粋関数のみ。外部API・LLM・DB・現在時刻に依存しない
 * （時刻が必要な場合は now: Date を引数で受ける）。
 */

export interface {Module}Input {
  // 入力型
}

export interface {Module}Result {
  // 出力型（判定理由 reasons: string[] を含めると監査ログと接続しやすい）
}

export function {functionName}(input: {Module}Input): {Module}Result {
  // 実装
}
```

3. `packages/{pkg}/tests/{module}.test.ts` を作成する:
   - describe/itタイトルに仕様IDを含める（例: `describe("{module} (TH-008)", ...)`）
   - 境界値・エラーケースを最低3ケース

4. `packages/{pkg}/src/index.ts` にexportを追加する（存在する場合）

5. 検証: `pnpm --filter @aiops/{pkg} run test` → `mise run traceability` がgreenであること
