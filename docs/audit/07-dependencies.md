# 07. 依存関係・技術的鮮度 監査レポート

- 監査日: 2026-07-11 / 監査対象コミット: `39b95944e9f17dffce500c21f40989f6fa86092d`
- 監査観点: ランタイム・依存ライブラリ・モデル ID の EOL / サポート状況 / 既知脆弱性を 2026-07-11 時点の公式情報と実測（pnpm audit / pnpm outdated）で突合。

## 1. 対象範囲と監査観点

.mise.toml / 各 package.json / pnpm-lock.yaml の解決版 / Dockerfile ベースイメージ / モデル ID。バージョン事実はすべて 2026-07-11 に Web で確認、インストール実態は `pnpm -r outdated` / `pnpm audit --prod` の実測。

## 2. あるべき姿

本番システムはサポート中のランタイム・依存で動くこと（EOL = セキュリティパッチ停止）。SDK 類はプロバイダの現行 API を表現できる版であること。既知脆弱性は棚卸しされ、受容するなら理由が記録されること。

## 3. 指摘事項サマリ

| ID          | タイトル                                                                     | Severity | 工数 |
| ----------- | ---------------------------------------------------------------------------- | -------- | ---- |
| AUD-DEP-001 | Node.js 20 が EOL（2026-04-30）— ランタイムとして・Docker ベースとして使用中 | Critical | M    |
| AUD-DEP-002 | pnpm 9 が EOL（2026-04-30）                                                  | High     | S    |
| AUD-DEP-003 | Anthropic SDK 群が大幅に陳腐化（0.32.1 vs 0.111.0 / 0.1.77 vs 0.3.207）      | High     | M    |
| AUD-DEP-004 | 既知脆弱性 4 件が prod 依存に存在（moderate 3 / low 1、pnpm audit 実測）     | Medium   | S    |
| AUD-DEP-005 | vitest 2 系がサポート外、zod 3 系がメンテナンスのみ                          | Medium   | M    |
| AUD-DEP-006 | 既定モデル claude-sonnet-4-6 がレガシー世代                                  | Medium   | S    |
| AUD-DEP-007 | exceljs が実質メンテナンス放棄（ADR-0008 の前提劣化）                        | Medium   | L    |
| AUD-DEP-008 | その他の陳腐化（ai SDK v5→v7、next-auth beta 固定、@hono/node-server v1 等） | Low      | M    |

## 4. 個別指摘

### AUD-DEP-001: Node.js 20 が EOL

| Severity | 工数 | 関連仕様                                                      | 関連指摘                 |
| -------- | ---- | ------------------------------------------------------------- | ------------------------ |
| Critical | M    | AGENTS.md「Node 20 / pnpm 9 固定」自体の更新が必要 / ADR-0004 | AUD-SEC-003, AUD-DEP-002 |

**現状**: `.mise.toml` が node=20 を固定し、Dockerfile も `node:20-slim`（build/runtime 両ステージ）。Node.js 20 は **2026-04-30 で EOL** となり、以後セキュリティパッチが出ない（出典: https://endoflife.date/nodejs 、確認日 2026-07-11）。監査時点で約 2.5 ヶ月 EOL 超過。
**根拠**: `.mise.toml`、`packages/server/Dockerfile:8,20`
**あるべき姿**: サポート中の LTS（Node 22: Maintenance LTS、2027-04 まで / Node 24: Active LTS）。
**推奨対応**: Node 22 へ更新（最小差分・@types/node 20.x も追随）。.mise.toml・Dockerfile・CI の setup-node・AGENTS.md 記載を同一 PR で更新し、`mise run ci` green を確認。

### AUD-DEP-002: pnpm 9 が EOL

| Severity | 工数 | 関連仕様 | 関連指摘    |
| -------- | ---- | -------- | ----------- |
| High     | S    | ADR-0004 | AUD-DEP-001 |

**現状**: pnpm 9.15.4 固定（.mise.toml / Dockerfile corepack / packageManager）。pnpm 9 は 2026-04-30 で EOL（出典: https://endoflife.date/pnpm 、確認日 2026-07-11）。
**推奨対応**: pnpm 10 へ（lockfile v9 互換で移行コスト小。11 へ一気でも可だが Node 更新と同時に変えるのは 1 段ずつが安全）。

### AUD-DEP-003: Anthropic SDK 群が大幅に陳腐化

| Severity | 工数 | 関連仕様                                  | 関連指摘                 |
| -------- | ---- | ----------------------------------------- | ------------------------ |
| High     | M    | ADR-0002（Claude API 使い分け）の実装基盤 | AUD-VER-001, AUD-DEP-006 |

**現状**（pnpm outdated 実測）: `@anthropic-ai/sdk` 0.32.1（最新 0.111.0、約 20 ヶ月・78 マイナー遅れ）、`@anthropic-ai/claude-agent-sdk` 0.1.77（最新 0.3.207）。0.x 系はマイナーで破壊的変更が入るため、現行モデル世代のパラメータ（adaptive thinking、output_config 等）を型レベルで表現できない。agent-sdk はヘッダコメント自身がオプション名変更リスクを警告している。
**根拠**: `pnpm -r outdated` 実測、`packages/shared/src/clients/claudeAgentClient.ts:23-25`
**推奨対応**: SDK 更新は AUD-VER-001/002 のテスト整備を**先に**行ってから実施（安全網なしの 78 マイナー更新は危険）。更新時に claudeAgentClient の allowedTools/disallowedTools オプション名の互換を必ず確認。

### AUD-DEP-004: 既知脆弱性 4 件が prod 依存に存在

| Severity | 工数 | 関連仕様 | 関連指摘    |
| -------- | ---- | -------- | ----------- |
| Medium   | S    | —        | AUD-DEP-008 |

**現状**（`pnpm audit --prod` 2026-07-11 実測）: moderate 3 件 — next-auth（GHSA-5jpx-9hw9-2fx4: Email misdelivery）、postcss（GHSA-qx2v-qp2m-jg93）、uuid（GHSA-w5hq-g745-h8pq）。low 1 件 — @ai-sdk/provider-utils（GHSA-866g-f22w-33x8）。なお next@15.5.20 / hono@4.12.28 は 2026-05 の各セキュリティリリース（Next.js middleware 認可バイパス群 / Hono の CORS・cache 系 CVE）を充足済みであることを確認した。
**根拠**: pnpm audit 実測出力
**推奨対応**: 4 件の更新 PR（いずれも上流に修正版あり）。あわせて `pnpm audit` を CI に追加し（fail レベルは high 以上から開始）、放置脆弱性が増えない構造にする。

### AUD-DEP-005: vitest 2 系がサポート外、zod 3 系がメンテナンスのみ

| Severity | 工数 | 関連仕様 | 関連指摘 |
| -------- | ---- | -------- | -------- |
| Medium   | M    | —        | —        |

**現状**: vitest 2.1.9（現行 4.1.10。サポートは現行マイナー + 前メジャー最新のみで、2 系はセキュリティ修正も出ない。出典: https://main.vitest.dev/releases 、確認日 2026-07-11）。zod 3.25.76（v4 が GA、v3 は保守のみ。出典: https://zod.dev/v4/versioning 、確認日 2026-07-11）。TypeScript は 5.9.3（現行 6.0、緊急性低）。
**推奨対応**: vitest 3 → 4 を段階更新（テスト資産 113 ファイルの互換確認が主工数）。zod v4 は全パッケージ横断のため独立 PR で（`zod/v3` サブパス併用の段階移行が公式ルート）。

### AUD-DEP-006: 既定モデル claude-sonnet-4-6 がレガシー世代

| Severity | 工数 | 関連仕様 | 関連指摘                 |
| -------- | ---- | -------- | ------------------------ |
| Medium   | S    | ADR-0002 | AUD-REL-006, AUD-DEP-003 |

**現状**: DEFAULT_MODEL="claude-sonnet-4-6"（anthropicClient.ts:23、web チャットも同モデル）。2026-07 時点で Sonnet 5 が現行であり、4-6 は提供中だがレガシー（出典: https://platform.claude.com/docs/en/about-claude/models/overview 、確認日 2026-07-11）。ESCALATION_MODEL="claude-opus-4-8" は現行。ハードコード価格表（AUD-REL-006）はモデル移行時に必ずドリフトする。
**推奨対応**: モデル ID を config 化（環境変数）し、Sonnet 5 移行は SDK 更新（AUD-DEP-003）後に実施。Sonnet 5 はサンプリングパラメータ制約とトークナイザ変更があるため、コスト見積り係数（len/4）の再較正も同時に。

### AUD-DEP-007: exceljs が実質メンテナンス放棄

| Severity | 工数 | 関連仕様                                                    | 関連指摘 |
| -------- | ---- | ----------------------------------------------------------- | -------- |
| Medium   | L    | ADR-0008（xlsx の CVE を理由に exceljs を採択）の前提が劣化 | —        |

**現状**: exceljs 4.4.0 は 2023 年が最終リリースで 2 年以上更新がなく、Snyk に medium 指摘がある（出典: https://security.snyk.io/package/npm/exceljs 、確認日 2026-07-11）。ADR-0008 は「xlsx の未修正 CVE 回避」を採択理由としたが、採択先も保守停止となり当時の根拠が崩れている。Excel 取込は外部から受けるファイルをパースする経路（攻撃面）である。
**推奨対応**: 即時の乗り換えは不要（ドロップイン代替がない）。ADR-0008 に追記して前提劣化を記録し、(a) 取込経路の防御強化（HMAC + repo allowlist + confirm ヘッダは実装済み — 加えてファイルサイズ/シート数上限とパース の子プロセス隔離を検討）、(b) 半年毎の代替ライブラリ再評価、を決定として残す。

### AUD-DEP-008: その他の陳腐化

| Severity | 工数 | 関連仕様                   | 関連指摘    |
| -------- | ---- | -------------------------- | ----------- |
| Low      | M    | ADR-0013（AI SDK v5 前提） | AUD-DEP-004 |

**現状**（pnpm outdated 実測）: ai 5.0.210（最新 7.0.22）と @ai-sdk/anthropic 2.0.85（最新 4.0.12）— ADR-0013 は v5 前提のため更新には ADR 改訂を伴う。next-auth 5.0.0-beta.25 固定（beta 依存が本番認証を担う）。@hono/node-server 1.19.14（最新 2.0.8）。next 15.5.20（16 系が最新だが 15.5 系はパッチ供給中で緊急性なし）。eslint 9（10 系あり、dev のみ）。
**推奨対応**: 四半期毎の依存棚卸しを定例化（dependabot は導入済みなので、グルーピング設定 or Renovate 化で PR ノイズを抑える）。next-auth は v5 正式版リリース状況を確認して beta 脱却。

## 5. 良好事項

- gitleaks 8.30.1 は最新（プロジェクトが feature-complete を宣言、出典: https://github.com/gitleaks/gitleaks/releases 、確認日 2026-07-11）。SHA256 検証付きバイナリ取得は模範的。
- dependabot.yml 導入済み、lockfile コミット + CI での frozen-lockfile、Actions の SHA ピン留めなど、サプライチェーンの基本装備は公式推奨に合致。
- ADR-0008 が採択当時に CVE を理由として記録していたからこそ、本監査で前提劣化を機械的に検出できた。意思決定の記録文化は機能している。
