# 実環境E2E検証 Runbook

対象: Phase V 統合検証で `requires-real-env` とした項目。

この runbook は、ローカルのモック、開発モード迂回、`app.request()` ではなく、実サービスを起動して外部依存先と接続した状態を確認するための手順である。

## 前提

- Node.js 20 / pnpm 9.15.4 / mise が利用できること。
- PostgreSQL サーバが起動しており、`packages/devops/src/db/schema.sql` と `pnpm --filter @aiops/devops db:migrate` を適用できること。
- GitHub App が対象 organization にインストール済みで、Projects v2 / Issues / Pull requests / Deployments / Webhooks の必要権限を持つこと。
- organization webhook が常駐 server の `PUBLIC_BASE_URL` に到達できること。
- Microsoft Teams アプリ manifest をテナントへ登録し、Graph change notifications と RSC 権限を設定済みであること。
- `ANTHROPIC_API_KEY` が設定され、実 LLM の 1 往復スモークを実行してよいこと。
- 実 GitHub 書込を伴うインポート検証は、本番リポジトリではなく検証用 organization / repository で行うこと。

## 環境変数

server:

```bash
export PORT=8080
export WEBUI_INTERNAL_PORT=3100
export DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/aiops
export GRAPH_CLIENT_STATE="$(openssl rand -hex 32)"
export GITHUB_WEBHOOK_SECRET="$(openssl rand -hex 32)"
export GRAPH_CLIENT_ID=...
export GRAPH_CLIENT_SECRET=...
export GRAPH_TENANT_ID=...
export PUBLIC_BASE_URL=https://aiops.example.com
export CODING_TASK_CALLBACK_SECRET="$(openssl rand -hex 32)"
export ANTHROPIC_API_KEY=...
```

web:

```bash
export AUTH_SECRET="$(openssl rand -hex 32)"
export AUTH_TRUST_HOST=true
export AUTH_MICROSOFT_ENTRA_ID_ID=...
export AUTH_MICROSOFT_ENTRA_ID_SECRET=...
export AUTH_MICROSOFT_ENTRA_ID_TENANT_ID=...
export DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/aiops
export ANTHROPIC_API_KEY=...
```

## 手順

1. 依存とビルドを確認する。

```bash
mise install
mise run install
mise run build
```

2. PostgreSQL に schema と migrations を適用する。

```bash
psql "$DATABASE_URL" -f packages/devops/src/db/schema.sql
pnpm --filter @aiops/devops db:migrate
```

3. Web を起動し、実 Entra ID セッションで確認する。

```bash
pnpm --filter @aiops/web exec next start -p 3100 -H 127.0.0.1
```

確認:

- `GET /app/login` が 200。
- Entra ID でサインイン後、`GET /app/dashboard` が 200。
- `GET /app/api/data/executive-summary` が PRF-04 セッションで 200。
- `GET /app/api/data/manager-summary` が PRF-03 または PRF-G セッションで 200。
- `GET /app/api/data/investor-summary` が investor セッションで 200。
- `GET /app/api/data/timeseries?period=week|month|quarter|half|year` が各 200。
- `GET /app/api/data/projects` が 200。
- `GET /app/api/data/agent-activity` が PRF-G セッションで 200。
- `POST /app/api/chat` が reasoning parts と tool call を含む応答を返す。
- サーバログに Auth.js / DB / LLM の未処理エラーが出ない。

4. server を起動して health/readiness を確認する。

```bash
pnpm --filter @aiops/server run start
curl -i http://127.0.0.1:8080/healthz
curl -i http://127.0.0.1:8080/readyz
```

確認:

- `/healthz` が 200。
- `/readyz` が 200。
- PostgreSQL を停止すると `/readyz` が 503 へ落ちる。

5. GitHub / Teams webhook を検証する。

- Graph validationToken handshake が 200 text/plain で token を返す。
- Graph notification が clientState 一致時に `events` へ queued される。
- GitHub webhook が正しい `x-hub-signature-256` で 202 になり、署名不正は 401 になる。
- Teams チャネル取込は `project_channels` に登録済みの channel のみ対象になる。

6. Excel import を検証する。

現 `agent/T12` 直上の T13 開始時点では Excel import 実装が stack に存在しない。実装が stack に統合された後、以下を実施する。

- テンプレート生成。
- 検証用 .xlsx に数行記入。
- dry-run で正常行とエラー行のレポート確認。
- 検証用 GitHub repository に対して実行。
- import ledger に記録されることを確認。
- 同じ .xlsx を再実行し、既処理行が skip されることを確認。

## チェックリスト

- [ ] PostgreSQL server に schema 適用済み。
- [ ] `recipients` に PRF-G / PRF-M / PRF-L の検証用ユーザーが存在する。
- [ ] PrjOps stakeholder master の検証用データが Web から参照できる。
- [ ] GitHub App installation token で対象 organization を読める。
- [ ] organization webhook が server に到達する。
- [ ] Teams manifest と Graph subscription が有効。
- [ ] `ANTHROPIC_API_KEY` で `/app/api/chat` 実 LLM スモークが成功。
- [ ] Excel import 実装が stack に統合済み。
- [ ] すべての観測ログを `verification/VERIFICATION_REPORT.md` に追記した。
