// eslint.config.mjs
//
// リポジトリ全体のESLint flat config（ESLint 9系 + typescript-eslint）。
// 各パッケージの package.json の "lint" スクリプトから
// `eslint . --config ../../eslint.config.mjs` の形で参照される。
//
// 注意: flat configの `files` パターンは ESLint 実行時の `process.cwd()` からの相対パスに対して
// マッチする（設定ファイル自身の場所からの相対ではない）。本リポジトリでは各パッケージディレクトリ内から
// `eslint .` を実行する運用のため、`files` パターンに `packages/` プレフィックスを付けると
// パッケージ内から実行した場合に一切マッチしなくなる。そのため以下のパターンはすべて
// 深さ非依存（`**/*.ts` 等）で記述し、リポジトリルート／各パッケージディレクトリのどちらから
// 実行しても同じルールが適用されるようにする。
//
// 方針:
//   - typescript-eslint の recommended（型情報を使わない軽量版）をベースにする。
//     モノレポ全体でtsconfigプロジェクト参照を組むと複雑になりすぎるため、
//     recommendedTypeChecked 等の型情報ベースルールは採用しない。
//   - eslint-config-prettier でスタイル系ルールを無効化し、Prettierと責務を分離する。
//   - packages/web 配下の *.tsx は React/JSX を含むため JSX パースを有効化する。
//   - vitest のテストファイル（packages/*/tests/*.test.ts）向けに vitest グローバルを許可する。

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/*.d.ts",
      "**/next-env.d.ts",
      "**/*.tsbuildinfo",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Node実行スクリプト（ジョブスクリプト・設定ファイル）。process/console等のNodeグローバルを許可する。
    files: ["**/*.mjs", "**/*.cjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      // 未使用変数は原則エラーだが、意図的に無視する引数/変数は `_` prefix で許容する
      // （既存コードの一部ハンドラ引数・分割代入で使用されているパターンを踏襲）。
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // vitest テストファイル: describe/it/expect 等のグローバルを許可
    files: ["**/tests/**/*.ts", "**/tests/**/*.tsx"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
        ...(globals.vitest ?? {}),
      },
    },
  },
  {
    // packages/web: React/JSXを含む
    files: ["**/*.tsx"],
    languageOptions: {
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  eslintConfigPrettier,
);
