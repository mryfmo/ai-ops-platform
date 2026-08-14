# P3-T06-REVIEW — JIT expiry and health workflows（writer=codex）

```yaml
task_id: P3-T06-REVIEW
reviewer: claude-deep-dot (claude-code-fable5-xhigh)
reviewed_at: 2026-08-14T09:05:00+09:00
head_sha: 7e3a7774498a3aa349c1949a62a671227a1eaa8b
verdict: approve
```

## 検分（adversarial、独立実行）

- **境界**: diff は control-plane + .orchestration のみ。`packages/devops`・
  `packages/server` 差分 0（既存 1m ループ不変更。権威 = AGT_SEC.revokeExpiredGrants /
  AGT_ORCH.evaluateFailsafe は activity DI 契約で再利用し複製なし）。
  merged P3-T02..T05 fixtures 差分 0。vitest coverage exclude 追加は
  scope amendment の条件内（新規 sandbox workflow 1 file のみ・threshold 不変・
  理由コメント追記）。
- **TMP-003**: revoke は authority read（候補列挙 + per-grant reconcile）→ shadow
  構造抑止 → single-attempt（maximumAttempts=1）→ 検証は helper 外
  （P3-T05 bot P2-1 の教訓反映）。lost-response fixture で revoke schedule 1 回 +
  前後 reconcile read を history 検分。unresolved は E-CP-EXTERNAL-UNRESOLVED
  non-retryable（成功偽装なし。失効は安全側で次 tick が再評価）。
- **expiry SLA**: 1m interval + catchupWindow=interval + overlap SKIP。
  shadow でも判定・読み取りは毎 tick 実行（cutover 時の挙動連続性）。
- **health 決定性と fail-safe 境界**: 評価 receipt は「3 連続失敗 ≥ activate_failsafe」
  へ正規化（fail-safe 方向）、適用 receipt は厳格一致検証で未適用 failsafe の
  偽確認を拒否 — worker の self-review 3 巡がこの実バグ（inconsistent receipt に
  よる failsafe 抑止）を red/green で検出・修正した経緯を validation で確認。
- **workflow kind**: 正典 7 kinds を拡張せず `incident` 名前空間へ写像
  （`incident/jit-expiry:global:N`）。canon 変更を避ける保守的選択として受容。
- **独立 gate 再現**: 158/158 tests / typecheck / lint / coverage 85.7%+（threshold
  超）/ fresh 使い捨て DB 再作成で `mise run ci` exit 0。
- **プロセス**: worker は AIOPS_PR_TOKEN 不可を正しく blocked-auth で報告
  （#207 事故の恒久則遵守）。PR は orchestrator が App token author で作成。

## 判定

findings 0（blocking なし）。clean-runner build-test + gitleaks green（head 7e3a777）確認済み。accept。
