# A016 acceptance record(P010-F02-T05 + T06 atomic)

- task_id: A016
- verdict: accepted
- reviewer: orchestrator-fable5 (claude-code)
- date: 2026-07-19
- review_source: .orchestration/validation/A016-validation.md(crit resolved 11 / unresolved 0)

## 検証(独立・実測)

- 残置 grep: production src に `resolveByEmail` / `findByEmail` / `session.user.email` / `user.email`
  の認可利用ゼロを確認。
- tools.ts はインライン PRF-G 判定を廃し `@aiops/devops isProjectInScope` へ経由。
- devops filter: scopeMode=project は allowlist 強制、global は PRF-G のみ、不正 scopeMode は fail-closed。
- 3 スイートを orchestrator 実行: devops 206 pass / prjops 387 pass / web 241 pass。
- resolver matrix テスト実在: 同一 email 別 oid DENY(:104)、email 変更同一 oid PASS(:143)、
  inactive/stale/別 oid 拒否(:188)、global fail-closed(:72)。
- スコープ相談 4 回(T06 統合、caller 2 ファイル、filter 2 ファイル、tools.ts)はすべて orchestrator が
  事前検証・承認済み。8 件の是正は全件 file:line + rationale 付きで報告に列挙(暗黙拡張なし)。

## P2 台帳(新規)

- **P2-05**: devops isProjectInScope の legacy fallback(ctx に scopeMode プロパティが無い場合、
  PRF-M 等が `return true`)は現役 production caller ゼロ(orchestrator が全 caller を grep 検証済み:
  web 経路は personaResolver が常に scopeMode 設定)だが、将来 caller に対して fail-open。
  owner: P010-F02-T07(delivery context を DB scope_mode から構築する際に legacy 分岐を除去し
  fail-closed へ)。date: F02-T07 実装時。

## 特記

- 外部 GitHub レビュースレッド(T05-only 中間状態の P1)は全 caller 対応済みだが、worker は
  無断 resolve せず未解決のまま残置(指示遵守)。merge 後に orchestrator 判断でクローズ可。
- QUESTION(role 意味論の契約未定義)は plan owner 宛に report へ記録済み — DEC-SPEC-003 の
  改訂が後続タスクの前提。

## next_action

- PR #110 merge → ancestry 確認 → GitHub の旧 P1 スレッドへ「T06 で全 caller 対応済み」と返信し
  resolve(orchestrator 承認済み)→ F02-T07 dispatch 待ち。
