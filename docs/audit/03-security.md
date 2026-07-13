# 03. セキュリティ 監査レポート

- 監査日: 2026-07-11 / 監査対象コミット: `39b95944e9f17dffce500c21f40989f6fa86092d`
- 監査観点: 攻撃面・権限境界・秘密情報・LLM 固有リスク（OWASP Top 10 for LLM Applications v2025 準拠）・ガバナンス強制力。

## 1. 対象範囲と監査観点

server（公開 HTTP 面）、web（認証・ヘッダ）、Docker イメージ、DB 権限、secretSanitizer、リポジトリガバナンス（CODEOWNERS/branch protection/gitleaks）。既知 CVE を持つ依存は [07-dependencies](07-dependencies.md) 側に置く。

## 2. あるべき姿（出典付き）

- OWASP Top 10 for LLM Applications **v2025**（LLM01 Prompt Injection / LLM05 Improper Output Handling / LLM06 Excessive Agency）に対する明示的対策と文書化（出典: https://owasp.org/www-project-top-10-for-large-language-model-applications/ 、確認日 2026-07-11）
- Anthropic 公式: 非信頼コンテンツは tool_result ブロックで隔離、ツールと権限は最小化（出典: https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks 、確認日 2026-07-11）
- コンテナ: 非 root USER・最小イメージ・ビルド成果物のみ同梱（12-factor / Docker 公式ガイド）
- 監査証跡: append-only は DB 層で REVOKE + 必要ならトリガガードで強制（出典: https://wiki.postgresql.org/wiki/Audit_trigger_91plus 、確認日 2026-07-11）
- 公開エンドポイントにはレート制限、メトリクスエンドポイントはネットワーク境界か認証で保護

## 3. 指摘事項サマリ

| ID          | タイトル                                                                 | Severity | 工数 |
| ----------- | ------------------------------------------------------------------------ | -------- | ---- |
| AUD-SEC-001 | branch protection が現行 GitHub プランで利用不可（ガバナンス前提の崩壊） | High     | S    |
| AUD-SEC-002 | 全 HTTP エンドポイントにレート制限がない                                 | High     | M    |
| AUD-SEC-003 | Docker イメージが root 実行・全ソース・devDeps 同梱                      | High     | S    |
| AUD-SEC-004 | audit_log の REVOKE が app_role 不在時に silent no-op                    | High     | S    |
| AUD-SEC-005 | /metrics が無認証公開                                                    | Medium   | S    |
| AUD-SEC-006 | CSP・セキュリティヘッダが皆無                                            | Medium   | S    |
| AUD-SEC-007 | 脅威モデル文書が存在しない（OWASP LLM v2025 未照合）                     | Medium   | M    |
| AUD-SEC-008 | secretSanitizer が既知プレフィックス形式のみ検出                         | Medium   | M    |
| AUD-SEC-009 | GITHUB_TOKEN が zod config 管理外                                        | Low      | S    |
| AUD-SEC-010 | .gitleaks.toml なし・pre-commit 層なし                                   | Low      | S    |

## 4. 個別指摘

### AUD-SEC-001: branch protection が現行 GitHub プランで利用不可

| Severity | 工数 | 関連仕様                                                         | 関連指摘    |
| -------- | ---- | ---------------------------------------------------------------- | ----------- |
| High     | S    | ADR-0006（自動マージ禁止・人間レビュー必須）の技術的強制力が不在 | AUD-OPS-007 |

**現状**: リポジトリは private であり、`gh api repos/mryfmo/ai-ops-platform/branches/main/protection` は HTTP 403「Upgrade to GitHub Pro or make this repository public to enable this feature」を返す（2026-07-11 実測）。つまり branch protection も CODEOWNERS レビュー必須化も**現行プランでは設定不可能**。AGENTS.md・production-gates.md が前提とする「ブランチ保護で CODEOWNERS review 必須化」は実現手段がない。
**根拠**: gh api 実測（403）、`.github/CODEOWNERS`、`runbooks/production-gates.md`
**あるべき姿**: AI エージェントが PR を生成する運用では、main への直接 push 禁止・レビュー必須・自動マージ禁止が**プラットフォーム側で強制**されていること（規約文書のみでは AI/人間どちらのミスも防げない）。
**ギャップ**: ADR-0006 のガバナンスモデル全体が「運用者の自制」にのみ依存している。go-live ゲートの前提条件が未充足。
**推奨対応**: 最小是正 = GitHub Pro/Team へのプラン変更 or organization への移管（無料でも public なら可だが本リポジトリは非公開前提）+ ruleset で required review / linear history / force-push 禁止を設定。CODEOWNERS も単一人物依存（バス係数 1）のため、go-live までに 2 人目のオーナー追加を検討。

### AUD-SEC-002: 全 HTTP エンドポイントにレート制限がない

| Severity | 工数 | 関連仕様                           | 関連指摘    |
| -------- | ---- | ---------------------------------- | ----------- |
| High     | M    | 仕様不在（DoS 耐性の仕様 ID なし） | AUD-SEC-005 |

**現状**: server・web ともレート制限・スロットリングの実装が 0 件（grep 確認済み）。webhook 系は HMAC で認証されるが、署名検証自体が CPU を消費するため無制限の不正リクエストで資源を奪える。`/coding-tasks/:id/confirm` の GET は token 総当たりに対する回数制限がない（HMAC token 長で実質防御されるが、多層防御の原則に反する）。
**根拠**: `packages/server/src/http/`、`packages/web/src`（grep: rate-limit/throttle 0 件）
**あるべき姿**: 公開面には IP/キー単位のレート制限（前段 LB/WAF でも可 — その場合は要件としてデプロイ文書に明記）。
**推奨対応**: 最小是正 = デプロイ要件として「前段リバースプロキシ/WAF でのレート制限必須」を runbook に明文化。恒久策 = hono-rate-limiter 等の軽量ミドルウェアを webhook 以外の対話系エンドポイントに導入。

### AUD-SEC-003: Docker イメージが root 実行・全ソース・devDeps 同梱

| Severity | 工数 | 関連仕様                                          | 関連指摘                 |
| -------- | ---- | ------------------------------------------------- | ------------------------ |
| High     | S    | ADR-0003/0005（コンテナ運用）に安全要件の記載なし | AUD-DEP-001, AUD-OPS-005 |

**現状**: runtime ステージが `COPY --from=build /repo /app` で**リポジトリ全体**（全ソース・テスト・devDependencies 込み node_modules）をコピーし、`USER` 指定なし（root 実行）、`HEALTHCHECK` なし。ベースは EOL の node:20-slim。
**根拠**: `packages/server/Dockerfile:19-31`（全文確認済み）
**あるべき姿**: `pnpm deploy --prod` 等で本番依存のみの成果物を作り、非 root USER・最小ランタイムで実行。イメージ内の不要ソースは侵害時の情報量と CVE 面積を増やすだけ。
**推奨対応**: 最小是正（1 PR 規模）= `USER node` 追加 + `pnpm --prod deploy` による成果物限定コピー + ベースを node:22-slim へ（AUD-DEP-001 と同時）。HEALTHCHECK は /healthz を叩く 1 行。

### AUD-SEC-004: audit_log の REVOKE が app_role 不在時に silent no-op

| Severity | 工数 | 関連仕様                                                         | 関連指摘    |
| -------- | ---- | ---------------------------------------------------------------- | ----------- |
| High     | S    | 設計原則 5（監査ログ追記専用）・schema 変更手順 3（REVOKE 維持） | AUD-REL-005 |

**現状**: schema.sql の DO ブロックは `pg_roles` に app_role が存在する場合のみ REVOKE/GRANT を実行する。ロール作成はインフラ側責務とされるが、作成漏れのままアプリを流すと**追記専用の保証が黙って消滅**し、検知手段がない。
**根拠**: `packages/devops/src/db/schema.sql:287-293`（確認済み）
**あるべき姿**: append-only は DB 層で無条件に強制。PostgreSQL 公式 wiki の監査パターンは REVOKE に加え BEFORE UPDATE/DELETE で例外を投げるトリガを併用する（出典: https://wiki.postgresql.org/wiki/Audit_trigger_91plus 、確認日 2026-07-11）。
**推奨対応**: 最小是正 = `/readyz` か起動時チェックに「app_role の UPDATE/DELETE 権限が REVOKE 済みか」の検証を追加し、未充足なら readiness 失敗。恒久策 = ロール非依存の BEFORE UPDATE/DELETE 例外トリガを audit_log に付与（superuser 以外を全遮断）。

### AUD-SEC-005: /metrics が無認証公開

| Severity | 工数 | 関連仕様 | 関連指摘    |
| -------- | ---- | -------- | ----------- |
| Medium   | S    | —        | AUD-SEC-002 |

**現状**: Prometheus メトリクスが公開ポート 8080 上で無認証提供される。キュー深度・タスク失敗・配信結果などの内部運用情報が漏れる。
**根拠**: `packages/server/src/http/app.ts`（/metrics ルート）
**推奨対応**: ネットワーク境界での遮断（内部ポート分離 or 前段 ACL）をデプロイ要件として明文化、またはベーシック認証/allowlist を追加。

### AUD-SEC-006: CSP・セキュリティヘッダが皆無

| Severity | 工数 | 関連仕様                                                            | 関連指摘    |
| -------- | ---- | ------------------------------------------------------------------- | ----------- |
| Medium   | S    | ADR-0013（Generative UI）— LLM 出力を UI に反映する構成では特に重要 | AUD-SEC-007 |

**現状**: next.config.mjs に headers() なし、server プロキシにもヘッダ付与なし。CSP / X-Frame-Options / HSTS / nosniff が一切ない（grep 確認済み）。ViewSpec 方式で LLM 出力の HTML 直挿入はないが、OWASP LLM05（Improper Output Handling）の防御層としての CSP が欠けている。
**根拠**: `packages/web/next.config.mjs`、`packages/server/src/http/webuiProxy.ts`
**推奨対応**: next.config.mjs の headers() で CSP（script-src 'self' 等）・HSTS・nosniff・frame-ancestors を一括付与（1 ファイル差分）。

### AUD-SEC-007: 脅威モデル文書が存在しない

| Severity | 工数 | 関連仕様                                                    | 関連指摘    |
| -------- | ---- | ----------------------------------------------------------- | ----------- |
| Medium   | M    | TH-xxx は「閾値」であり脅威モデルではない（用語衝突に注意） | AUD-TRC-004 |

**現状**: docs/・runbooks/ に脅威モデル（STRIDE 等）が存在しない。実装には優れた個別対策（tool_result 相当の入力隔離、capability-scoped tools、ViewSpec 限定出力、コスト上限 = OWASP LLM06/LLM10 対策に相当）が散在するが、**どの脅威に何が対応するかの体系がなく、抜けを検証できない**。例: プロンプトインジェクション（LLM01）で Teams 自由文が AGT-02 の LLM に渡る経路のリスク評価が文書化されていない。
**根拠**: docs/ 全体 grep（threat/脅威 0 件）
**あるべき姿**: OWASP LLM Top 10 v2025 の各項目 × 本システムの LLM 経路（AGT-02/03/04/BLD/INC/CHG/page-agent）のマッピング表 + STRIDE 簡易版。
**推奨対応**: docs/spec/threat-model.md を新設し、既存対策を棚卸しして対応表を作る（実装変更なしで書ける。抜けが見つかればそれが次の指摘）。

### AUD-SEC-008: secretSanitizer が既知プレフィックス形式のみ検出

| Severity | 工数 | 関連仕様                                              | 関連指摘 |
| -------- | ---- | ----------------------------------------------------- | -------- |
| Medium   | M    | 設計原則 4（秘密情報の多層防御）の 1 層目の検出力限界 | —        |

**現状**: 10 個の正規表現（GitHub PAT/Anthropic key/AWS/Azure/JWT/PEM 等）による形式一致のみ。社内独自形式のトークンや bare な高エントロピー文字列は素通しする。これは LLM 入力前・DB 保存前・監査ログ書込前の共通ゲートなので、検出漏れは 3 層すべてを抜ける。
**根拠**: `packages/shared/src/secretSanitizer.ts`（SECRET_PATTERNS）
**あるべき姿**: gitleaks 公式も正規表現主体 + エントロピーは補助シグナルという整理（誤検知とのトレードオフ）。運用固有のトークン形式はカスタムルール追加が前提（出典: https://github.com/gitleaks/gitleaks 、確認日 2026-07-11）。
**推奨対応**: 最小是正 = 運用で使う社内トークン形式を SECRET_PATTERNS に追加できる注入ポイントを設ける（現在は定数）。恒久策 = 長さ 32+ の base64/hex 連続文字列への警告付きマスク（誤検知は audit ログで追跡可能な設計に）。

### AUD-SEC-009: GITHUB_TOKEN が zod config 管理外

| Severity | 工数 | 関連仕様 | 関連指摘    |
| -------- | ---- | -------- | ----------- |
| Low      | S    | —        | AUD-IMP-001 |

**現状**: `process.env.GITHUB_TOKEN` を index.ts が直接読み、config.ts の zod fail-fast 検証を迂回している。他の全 secret は最小長検証付きで config 管理されており、これだけが例外。
**根拠**: `packages/server/src/index.ts:188`、`packages/server/src/config.ts`
**推奨対応**: AUD-IMP-001 の是正に含めて config へ移動。

### AUD-SEC-010: .gitleaks.toml なし・pre-commit 層なし

| Severity | 工数 | 関連仕様 | 関連指摘 |
| -------- | ---- | -------- | -------- |
| Low      | S    | —        | —        |

**現状**: gitleaks は CI でデフォルトルール実行のみ（allowlist はコミット済みだが設定ファイル本体なし）。pre-commit フック層がなく、秘密がコミットされてから CI で発覚する（履歴からの除去コストが高い）。
**推奨対応**: `.gitleaks.toml` を追加し allowlist を集約 + `gitleaks protect --staged` の pre-commit フックを導入（バージョンは CI と同じ 8.30.1 に固定）。

## 5. 良好事項

- webhook 署名検証は模範的: GitHub は raw body への HMAC-SHA256 + `timingSafeEqual`、Graph は clientState 検証 + 検証結果を漏らさない 202 応答。
- coding-task の人間確認ゲート（HMAC トークン + 明示 POST でのみ workflow_dispatch）、callback の Bearer 検証 + 状態遷移ガードは OWASP LLM06（Excessive Agency）対策として設計どおり機能する形。
- SQL は全リポジトリでパラメタライズド（$1 形式）を確認。監査ログ書込前の secret 検出は「マスクして書く」ではなく「書込拒否（E-AUD02）」という強い側の設計。
- Actions の SHA ピン留め + gitleaks バイナリの SHA256 検証、frozen-lockfile は公式推奨どおり（出典: https://docs.github.com/en/actions/reference/security/secure-use 、確認日 2026-07-11）。
