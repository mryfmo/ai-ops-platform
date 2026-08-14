# P3-T09-REVIEW — Temporal scheduler shadow（writer=codex）

```yaml
task_id: P3-T09-REVIEW
reviewer: claude-deep-dot
head_sha: 7198115dee2906ea35ae7b299f9e485776b7b73f
verdict: approve
```

## Findings

### P3-T09-R01 — high — 重量 AST テストが既定 5s timeout で並列 coverage 時に落ちる

- `tests/temporalShadow.test.ts` の「scheduler task の追加・欠落を fail-closed で
  拒否する」は runTemporalShadowComparison を 5 回以上実行し（各回が index.ts +
  複数 workflow source の AST full parse）、既定 5s timeout に対し余裕がない。
- reviewer の独立 full CI（素の `mise run ci`、並列 coverage）で timeout 再現:
  `Test timed out in 5000ms`（1 failed / 859 passed）。`VITEST_MAX_WORKERS=1`
  では 4/4 green — worker の validation はこの env 付きで CI を回しており、
  素の Definition of Done（`mise run ci`）と GitHub clean runner の実行形態では
  落ちる潜在 breaker。
- 是正: 重量テストへ明示 timeout（repo 慣行どおり最終引数、例 120_000。replay
  系は 60_000 前例）を付与し、**素の** `mise run ci`（VITEST_MAX_WORKERS 指定なし）
  を fresh 使い捨て DB で green にして validation を更新すること。テスト分割で
  各 it を軽くする選択も可。

## 検分済み（good）

- DELTA-01: 15/15 inventory（inline capability-metrics-refresh-30s 含む）を AST で
  順序込み捕捉、条件付き（jit-revocation の flag off）も検証。将来 task 追加/欠落/
  重複/並べ替え/retiming は fail-closed。
- 副作用抑止: structural-plan-only + esbuild bundle への network-module 拒否 +
  node --permission（fs write/child/worker/addon 拒否）+ network 拒否 preload。
  externalWrites 0 を evidence に記録。reviewer 環境で決定的再現（同一出力）。
- 比較結果: 12 match / 3 reasoned / 0 unreasoned / 1 temporal-only。
- 境界: index.ts 差分 0（観測 hook すら不要の設計）、server src / control-plane /
  manifests / lockfile 差分 0。App-token 規約は blocked-auth で正しく遵守。
- server typecheck / lint green、shadow 4/4（単独実行）green。

## Round 2（head `f5a38ac`）

- R01 resolved: 該当 it へ明示 `120_000` timeout（repo 慣行の最終引数方式、
  delta は test 1 行 + validation 更新のみ）。reviewer が**素の** `mise run ci`
  （VITEST_MAX_WORKERS なし・fresh 使い捨て DB）を独立再現し exit 0。
- verdict: **approve**。

## R02（clean runner、head `f5a38ac`）— high

- GitHub build-test が「TMP-003 shadow は plan-only で外部 write capability を
  持たない」で fail: `spawnSync node_modules/.bin/esbuild ENOENT`。esbuild は
  どの package manifest にも未宣言で、root `.bin` の存在はローカル hoisting の
  偶存だった（reviewer のローカル素 CI では検出不能な環境差 — clean runner が
  authoritative であることの再確認）。
- 是正（task file amendment 2026-08-14）: (a) server devDeps へ esbuild を
  tree 既存 version（0.28.1）で exact 宣言 + `require.resolve` 解決、または
  (b) bundle-denial 検証を dev-only runner 側へ移し CI は source-level 検証に
  限定。新規 version 導入は不可。素の fresh-DB `mise run ci` green 再確認必須。

## Round 3（head `7198115`）

- R02 resolved: esbuild を server devDeps へ exact 0.28.1 で宣言（tree 既存
  version、lockfile 3 行のみ）し、テストは公式 buildSync JS API へ移行 —
  `.bin` path spawn の hoisting 依存を除去し CI bundle-denial 検証は保持。
  worker の native-bin 指摘（process.execPath 案の不成立）は正しく、amendment
  を修正のうえ採択。
- reviewer 独立再現: frozen install exit 0 / shadow 4/4 / 素の fresh-DB
  `mise run ci` exit 0。verdict: **approve**（clean-runner CI green 確認後 accept）。
