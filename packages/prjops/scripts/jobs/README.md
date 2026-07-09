# packages/prjops/scripts/jobs/

このディレクトリは、`packages/prjops/src/workflows/*.yml`（GitHub Actions）から呼び出される
ジョブ実行スクリプトを置く場所である。

`request-weekly.mjs` に、実クレデンシャル（Microsoft Graph API、GitHub）を用いて
`packages/prjops/src/agents/*.ts` の関数を呼び出す具体的なパターンを実装済み。

他のジョブ（`remind-weekly.mjs`, `analyze-weekly.mjs`, `report-weekly.mjs`, `verify-weekly.mjs`,
`deliver-weekly.mjs`, `track-daily.mjs`, `monthly-quarterly-check.mjs`, `escalate-to-pmo.mjs`）も
同一パターンで実装できる。

## パターン

1. 環境変数から認証情報を読む（`GRAPH_CLIENT_ID`等。GitHub Actions Secretsから注入される）。
2. `@aiops/shared`のクライアント（`GraphClient`, `GitHubClient`, `AnthropicStructuredClient`）を
   実認証情報で組み立てる。
3. `prjops-data`リポジトリ（チェックアウト済み、または別途cloneした）のYAMLを読む。
4. `@aiops/prjops`の対応するagents層の関数（`AGT01_orchestrator`〜`AGT07_verifier`）を呼ぶ。
5. 結果と`trace_id`をログ出力する（GitHub Actionsのログに残り、障害調査に使う）。

## なぜ全ジョブを実装しなかったか

このリポジトリは、依頼された「仕様と実装コード・検証コードの相互参照」「決定的ロジックの正しさの
検証」を最優先に開発した。決定的ロジック（`src/lib/`, `src/agents/`のうちLLM非依存部分）は
すべて実装・テスト済みである。一方、上記スクリプトのような「実認証情報でAPIを呼ぶ薄い配線」は、
実際のGitHub Organization・Microsoft 365テナントが用意された時点で、この`request-weekly.mjs`と
全く同じパターンを機械的に複製すれば数十分で完成する性質のものであり、かつネットワーク遮断の
著者環境では実行確認自体ができない（`verification/VERIFICATION_REPORT.md`参照）。
そのため、パターンを示す代表例1件を高品質に実装し、他は本READMEで明示的に手順化する方針を採った。
