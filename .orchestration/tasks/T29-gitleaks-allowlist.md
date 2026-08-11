# T29: gitleaks の test-fixture 誤検知を allowlist で解消(main CI green 化)

## 背景

main へのマージ後、GitHub Actions の `ci` ワークフローで `build-test` は success だが **`gitleaks` ジョブが exit 1 で失敗**。原因は**秘密情報サニタイザのテスト fixture(意図的な偽 `ghp_` トークン)を誤検知**したもの(実際の漏洩ではない):

- `packages/shared/tests/secretSanitizer.test.ts:6` — `token: [REDACTED TEST PAT]`(サニタイズ検証用の偽 PAT)
- `packages/server/tests/freeTextIntent.test.ts:73` — `token: [REDACTED TEST PAT]`(偽 PAT)
- `packages/server/tests/pmTimeseriesRepo.test.ts:35` 付近 — gitleaks generic-api-key 検知

これらは「秘密情報が正しく redact されること」を検証するための fixture であり、存在が必須。gitleaks(8.30.1)がそれを漏洩として誤検知している。

## ブランチ

- `chore/gitleaks-allowlist` を **main から**作成、PR base は main。着手前 /compact 任意

## 是正

リポジトリ直下に **`.gitleaks.toml`** を新規作成し、上記 3 つの**テスト fixture ファイルに限定**した allowlist を追加(他所の実秘密は引き続き検知するようスコープを絞る)。gitleaks の default ルールは維持:

```toml
# 根拠: REQ-032 / DevOps REQ-030（gitleaks 秘密情報検知, DEV-10）。
# 秘密情報サニタイザの検証には意図的な偽トークンを fixture として持つ必要があるため、
# 当該テストファイルのみ allowlist する。実コード・他テストの秘密は既定ルールで検知継続。
title = "ai-ops-platform gitleaks config"

[extend]
useDefault = true

[allowlist]
description = "Intentional fake tokens in secret-redaction test fixtures"
paths = [
  '''packages/shared/tests/secretSanitizer\.test\.ts''',
  '''packages/server/tests/freeTextIntent\.test\.ts''',
  '''packages/server/tests/pmTimeseriesRepo\.test\.ts''',
]
```

- ci.yml の gitleaks 実行が `.gitleaks.toml` を自動で読む(gitleaks はカレントの `.gitleaks.toml` を既定で使用)。必要なら ci.yml の gitleaks ステップに `--config .gitleaks.toml` を明示。**ci.yml を変更する場合も gitleaks ジョブのみ**、他ジョブは触らない
- 可能なら `gitleaks detect --no-git --config .gitleaks.toml` 相当をローカル確認(gitleaks 未インストールなら「設定が 3 fixture を allowlist する」ことをレビューで確認と report に明記。過大申告しない)

## 規約 / Forbidden

- 依存追加なし。main への直接 push 禁止(PR 経由)。`.orchestration/` は commit しない。**allowlist は 3 fixture ファイルに限定**し、`**/tests/**` 全体や広域除外はしない(実秘密の見逃し防止)。**偽トークンをコードから消さない**(fixture は必要)
- DoD: `mise run ci` green(gitleaks は別ジョブなので mise run ci には含まれないが既存テストが壊れないこと)。PR 作成(base main、`ai-generated` ラベル)

## Expected artifacts(絶対パス)

- report: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/reports/T29-report.md`
- validation: `/Users/mryfmo/Workspace/ai-ops-platform/.orchestration/validation/T29-validation.txt`
- sandbox / learning / autoskill: 同ディレクトリ T29-*.md

## Done signal

```sh
~/.agents/skills/agmsg/scripts/send.sh ai-ops-platform codex-gpt55-high orchestrator-fable5 'AGMSG-RESULT v1 task_id=T29 status=ready_for_review report=... validation=... sandbox=... learning=... autoskill=... pr=<url>'
```

max_turns: 30

---

## revise: TOML キー修正(gitleaks 8.30.1 の config parse エラー)

PR #39 の gitleaks が `FTL Failed to load config error="'AllowList' expected a map, got 'slice'"` で失敗。原因は**タスク仕様の TOML キー誤り**(orchestrator の template ミス): `[[allowlist]]`(配列)でなく `[allowlist]`(単一テーブル)が正しい。config は自動ロードされている(`--config` 不要)。

### 是正
- `.gitleaks.toml` の `[[allowlist]]` を **`[allowlist]`** に変更(単一テーブル)。paths の 3 fixture 限定は維持
- 同ブランチ `chore/gitleaks-allowlist` に commit + push(PR #39 更新)
- 検証: 可能なら `./gitleaks detect --source . --redact` 相当をローカルで走らせ green を確認(gitleaks 未インストールなら PR #39 の gitleaks チェックで確認する旨 report に明記)。過大申告しない
