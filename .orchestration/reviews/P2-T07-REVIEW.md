# P2-T07-REVIEW — PR #191 at `abed4c8`

```yaml
task_id: P2-T07-REVIEW
reviewer: claude-deep-dot
reviewed_at: 2026-08-12T21:15:00+09:00
pull_request: https://github.com/mryfmo/ai-ops-platform/pull/191
base_sha: 8ab347e
head_sha: abed4c8
verdict: approve
findings: []
```

## Independent evidence（全 diff 読了 + 自前再現。worker 報告値の引用ではない）

- 変更は 11 ファイル・許可パスのみ（web src/tests + config inventory 3 点セット）。
  依存・lockfile 変更なし
- 実装読解: `createWebGatewayFetch` は **origin + path prefix を認証ヘッダ付与前に強制**、
  `redirect: "error"`、`x-api-key` 削除、空 key 拒否 — P2-T05 の egress 契約と同型。
  `createWebChatModel` は alias 検証 + gateway 構成必須の fail-fast。direct 分岐は存在しない
  （flag off = 503、P2-T06-001/007 の裁定どおり）
- config: `optionalTrimmed`（空文字未設定同一視）、URL の credentials/query/fragment 拒否
  （server 版より厳格）、`LITELLM_WEB_VIRTUAL_KEY` は server key と別スコープ・
  WEB_BFF secret 重複検査にも組込み。`ANTHROPIC_API_KEY` は web schema から完全撤去
- persona/data 規則: `chatHandler.ts` の差分はコメント/型注記のみ、`route.ts` は
  provider 構築行の差し替えのみ。resolver / costGuard / authGuard 経路に変更なし
- fitness: raw ban oracle（`@anthropic-ai/` / `ANTHROPIC_API_KEY` / provider host）+
  自己検証サンプル + `@ai-sdk/anthropic` 構築点の factory 限定 + alias 集合の manifest
  一致 — server 版 oracle の教訓（P2-T06-004）を踏襲
- 独立実行: web **324 passed | 1 skipped**、typecheck green、`mise run traceability` green
- **real gateway smoke を独立再現**（oss.3 digest + postgres sidecar を新規起動）:
  `/v1/models` = 8 alias 完全一致、`POST /v1/messages`（claude-standard、stream）は
  gateway 到達のうえ dummy Bedrock binding 由来の構造化 404 API エラー
  （transport 障害ではない）— worker の validation 記載と一致
- 実 provider 資格の不使用・full E2E の P2-T03/T04 繰延は task 指示どおり

## Noted（非 finding）

- virtual key は構築時解決（env 由来のため実質同等だが、rotation は再起動前提。
  server 側の per-request 解決との非対称は web の env モデル上妥当）
- alias 集合は web 側にも複製されるが manifest 一致テストがドリフトを封じている
