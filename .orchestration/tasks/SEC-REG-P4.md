# SEC-REG-P4: agentgateway / OPA の license register クローズ用 evidence pack

- task_id: SEC-REG-P4
- writer: codex-deep-dot
- reviewer: claude-code-fable5-xhigh（orchestrator）
- 目的: register（docs/security/2026-08-10-license-service-review-register.md）の
  agentgateway・OPA 行の Unknowns を **evidence で潰し、Owner/Security が
  承認判断だけすれば済む状態**にする。承認 role の記入は行わない
  （Decision record は Owner 権限 — reject-retroactive-evidence 原則）

## Objective（evidence pack の内容）

1. **Exact release**: 既に pin 済みの 2 image
   （agentgateway v1.4.1@sha256:efd79355… / OPA 1.19.0-static@sha256:2f42ca76…）
   と upstream release/commit の対応を一次情報 URL 付きで確定
2. **Dependency license inventory**:
   - agentgateway: release commit `163ea2146acb…` の Cargo.lock から
     依存 crate を列挙し、license を集計（license 種別ごとの件数表 +
     copyleft/非互換候補の個別列挙。取得方法と再現コマンドを記録）
   - OPA: v1.19.0 の go.mod/go.sum から同様に集計
   - LLM による推測禁止。license 判定は crates.io/pkg.go.dev/upstream
     metadata の機械取得を根拠にし、判定不能は UNKNOWN として明示列挙
3. **NOTICE/attribution**: 両 image 内の LICENSE/NOTICE ファイルの有無と内容
   （container run で実測）+ 配布時の同梱方針案（deploy 台帳に追記する形の提案）
4. **Vendor terms**: 商用 distribution/support の調達なし（self-hosted OSS のみ）
   の宣言に必要な確認事項の列挙
5. **Register 追記 draft**: 上記を register の該当行へ反映する diff 案
   （Unknowns → evidence 済みへ。Decision record 表は UNKNOWN/OPEN のまま）

## Scope / allowed_paths

- `docs/security/2026-08-10-license-service-review-register.md`（evidence 追記
  draft のみ。Decision record 表は変更禁止）
- `docs/security/evidence/**`（新規 evidence ファイル）
- `.orchestration/**`（証跡）

## Forbidden

- Decision record（Owner/Legal/Security/Procurement 行）の記入・変更
- 承認済みを示唆する記述（evidence と承認の区別を明確に）
- 依存追加・コード変更・image の変更

## Validation

- inventory の再現コマンドと出力を validation へ記録（第三者が再実行可能な形）
- `mise run ci` exit 0（docs 変更のみだが単独判定）

## PR / blocked-auth

- branch `agent/SEC-REG-P4-license-evidence`、commit → AGMSG-RESULT →
  orchestrator が push/PR 代行。draft 禁止

## Expected artifacts

- report / validation: `.orchestration/{reports,validation}/SEC-REG-P4-*.md`
- sandbox / learning / autoskill: 同規約

## Done signal

AGMSG-RESULT v1 task_id=SEC-REG-P4 status=ready_for_review
