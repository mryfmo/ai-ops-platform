# P3-T01 validation

実行者: claude-code-fable5-xhigh（writer）。日付: 2026-08-13。

## unit tests（packages/control-plane）

- 16/16 green（既存 7 + 新規 9: profile/namespace/task-queue 規約、証明書 identity
  解析の正負、client 側 fail-closed guard、接続 factory の DI 検証。
  テスト用証明書は openssl で実行時生成 — 秘密鍵をリポジトリへ置かない）

## Temporal mTLS smoke（Apple container、pinned digest）

- `./deploy/temporal/smoke.sh` → **SMOKE PASS**
  - image: temporalio/auto-setup:1.25.2@sha256:b1edc1e2…（postgres:16-alpine sidecar）
  - OK: dev worker mTLS connect + describeNamespace(aiops-dev)
  - OK: staging cert rejected by client guard before connect（E-TMP01、connect 未呼び出し）
  - OK: staging-issued cert rejected by server TLS（**per-env CA = 環境スコープの server 強制**）
  - OK: no-client-cert connection rejected（TEMPORAL_TLS_REQUIRE_CLIENT_AUTH=true）
- 実装過程の是正: (1) internal system worker / auto-setup CLI が平文接続で boot 失敗
  → docker template の TLS env 一式（FRONTEND_CERT/KEY・CLIENT1_CA・新 CLI 用
  TEMPORAL_TLS_CA/CERT/KEY/SERVER_NAME）で解消 (2) server cert SAN に規約名を追加し
  client は serverNameOverride で検証（IP 直指定でも TLS 検証を弱めない）

## Terraform（deploy/aws/temporal）

- `terraform init -backend=false` + `terraform validate` → Success、`fmt -check` green
- apply は AWS baseline / ENV gate 後（変数で P10-T01 所有資源を参照する構造）

## repository gates

- format / lint / traceability green（`.prettierignore` に `**/.terraform/` を追加 —
  provider バイナリを prettier が読んで落ちる問題の恒久対処）
- fresh 使い捨て DB で `mise run ci` 単独 exit 0
- lockfile: `@temporalio/client@1.22.0` の exact-pin 追加に伴う正当な更新のみ

## レビュー是正後の再検証（P3-T01-001..005、head 86eabb5）

- **001（server 側認可）**: Temporal 標準 authorizer/claim mapper + 内部発行 RS256 JWT を
  実装（Owner 裁定 2026-08-13 = ENV-DEC-001 改訂、PR #198）。smoke 拒否マトリクスを
  9 項目へ拡張し全 green:
  operator(admin JWT) の namespace 登録許可 / worker(namespace:write) の自 namespace
  describe 許可 / **越境 namespace 拒否** / **admin API（registerNamespace）拒否** /
  **無トークン拒否（mTLS のみでは何もできない）** / **偽署名（他環境鍵）拒否** /
  per-env CA の越境 cert TLS 拒否 / no-cert 拒否 / client guard の接続前拒否
- 002: Fargate は Secrets Manager → *_DATA env（config template native）+ JWKS sidecar。
  smoke 実証済み env 一式を task definition に反映
- 003: Cloud Map（temporal.<env>.aiops.internal:7233 出力）+ RDS SG 5432 相互経路
- 004: egress を RDS SG 5432 / VPC endpoints SG 443 に限定
- 005: .terraform.lock.hcl commit（provider 5.100.0）+ image digest regex validation
- 付随: JWKS 配信面を public/ に分離（署名鍵の HTTP 露出を排除）、shellcheck clean、
  compose を smoke と同形へ。terraform validate/fmt green、fresh DB CI exit 0、
  control-plane 16/16

## Round 4→5 (2026-08-13)

- Round-4 verdict: request_changes — resolved=009,010,012 / remaining=011。
- 011 実態: `6d6aad2` の merge-base diff に `pnpm-workspace.yaml` の `"@swc/core": false` が残存。
  round-4 update で「revert 済み」と報告したが、shared worktree の branch flip により
  revert が別 branch 側に落ち commit に載っていなかった（報告と head の乖離）。
- 是正 head: `e7a85ed`（pnpm-workspace.yaml を origin/main と byte-identical に復元のみ）。
  - `git diff origin/main -- pnpm-workspace.yaml` → 空
  - `pnpm install --frozen-lockfile` → exit 0
  - control-plane tests → 22/22 passed
- Round-5 re-review を codex-deep-dot に発注（scope: merge-base diff の境界確認）。

## Round 5→6 (2026-08-13)

- Round-5 verdict: request_changes — 011 resolved / new 013 (medium)。
- 013 裁定: **codex 指摘を採択**。`"@swc/core": false` は @temporalio/worker@1.22.0 の
  transitive @swc/core@1.15.47 に対する allowBuilds 明示 deny で、除去すると clean runner の
  pnpm 11 が ERR_PNPM_IGNORED_BUILDS で install 停止（GH run 31660134456）。011 の実相は
  「境界外変更」ではなく「task scope が必要随伴物を列挙していなかった」。
- 是正: task file allowed_paths に scope amendment 2026-08-13 を記録し、エントリを復元。
  head `541a95f`。
- 検証: fresh git worktree（node_modules 空）で `pnpm install --frozen-lockfile` exit 0、
  IGNORED_BUILDS 出力 0 件。authoritative 判定は新 head の GH build-test（クリーン runner）。

### Round 6 補遺: wrong-branch commit の再発と復旧

- 013 是正 commit `541a95f` は codex の round-5 検分中に worktree branch が
  `agent/P2-T09-dual-path-conformance` へ flip していたため P2-T09 側に落ち、
  push は no-op（remote 未反映）。codex が round-6 blocked（not_reviewed）で検出。
- 復旧: P3-T01 branch へ cherry-pick → 正 head `a3513de`（remote 一致確認済み）、
  P2-T09 local branch は `e5342c0` へ復元。
- 恒久則（L-P3T01-04 強化）: commit 直前に `git branch --show-current`、push 直後に
  `git ls-remote` で remote head 一致、報告前に `git diff origin/main...origin/<branch>`
  の三点検証を必須とする。
