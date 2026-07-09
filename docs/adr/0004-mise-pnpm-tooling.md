# ADR-0004: ツールバージョン管理をmiseに、パッケージマネージャをpnpmに変更する

## ステータス

採用

## コンテキスト

- ADR-0001時点では`npm`ワークスペースでモノレポを構成していたが、`npm`はNode.js本体・pnpm/yarn等の
  他ツールのバージョンまでは管理できず、Node.jsバージョンは`package.json`の`engines`フィールド
  （強制力のないヒント）に依存していた。
- モノレポの4パッケージ（`shared`/`prjops`/`devops`/`traceability`）は相互に`@aiops/shared`への
  ワークスペース内依存を持ち、依存関係のホイスティングやシンボリックリンクの厳密さは
  パッケージマネージャによって挙動が異なる。

## 決定

- **ツールバージョン管理**: `mise`（`.mise.toml`）でNode.js（20系）・pnpm（9系）のバージョンを
  リポジトリ内に固定する。開発者・CIとも`mise install`でツール本体を揃え、以後は
  `mise run <task>`（`install`/`build`/`test`/`test:coverage`/`lint`/`typecheck`/`traceability`/`ci`）
  でタスクを実行する。CIでは`jdx/mise-action`を使用する。
- **パッケージマネージャ**: `npm`から`pnpm`に変更する。ルートに`pnpm-workspace.yaml`を追加し、
  各パッケージの`package.json`の`workspaces`フィールドは廃止する。パッケージ間依存
  （`@aiops/shared`への参照）は`"workspace:*"`プロトコルで明示する。

## 根拠

- pnpmはワークスペース内依存をシンボリックリンクで厳密に解決し、`node_modules`の
  フラット化による意図しない依存の混入（phantom dependency）を防ぐ。1名開発とはいえ、
  `shared`パッケージの変更が両システムに影響するという運用ルール（ADR-0001「影響」節）を
  保守するうえで、依存解決の厳密さは有利に働く。
- `mise`はNode.js自体のバージョンも含めて単一ファイル（`.mise.toml`）でピン止めできるため、
  「`engines`フィールドは目安に過ぎず強制されない」という`npm`単体運用時の弱点を解消できる。
- タスクランナーを`mise run <task>`に統一することで、ローカル開発・CI・
  各エージェントの実行ワークフロー（`packages/{prjops,devops}/src/workflows/*.yml`）が
  同じコマンド体系を参照できる。

## 影響

- `.github/workflows/ci.yml`および`packages/{prjops,devops}/src/workflows/*.yml`の
  `actions/setup-node`+`npm ci`ステップを、`jdx/mise-action`+`pnpm install --frozen-lockfile`に
  置き換えた。
- 開発者は`npm install`ではなく`mise install && mise run install`（またはmise配下の`pnpm install`）
  で環境を構築する。README（`README.md` §2）を更新済み。
- `verification/VERIFICATION_REPORT.md`中の今後の検証手順（`npm install && npm test`等の記述）を
  `mise run install` / `mise run test`に置き換えた。ADR-0001は当時の決定の記録として文言を
  そのまま残し、本ADRで移行を明示する。
