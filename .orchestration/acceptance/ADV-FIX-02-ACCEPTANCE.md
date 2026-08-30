# ADV-FIX-02 Acceptance

- date: 2026-08-18
- status: accepted
- task: .orchestration/tasks/ADV-FIX-02-approval-path.md
- result head: 01a364fa74e11b8009324046eaef626025c815a7 (impl: 1b0d83a, revise: 01a364f)
- PR: https://github.com/mryfmo/ai-ops-platform/pull/273 (open, non-draft, ai-generated, merge は人間レビュアー)
- cost: n/a

## 判定根拠(オーケストレータ敵対的レビュー)

- C-1 の3ブロッカー解消を diff 直読で確認: create() が同一INSERTで expected_version=1 + expires_at=now()+60min(TH-002整合・PG時計)、GET /approvals は canDecide 行のみに identity 束縛 correlation を配布(scope外/legacy行への非配布 negative テストあり、expectedVersion 生値非露出)、web BFF は server 契約どおりの body を構成・署名。
- M-18 解消: Panel の loading 状態、400/401/403/409/503 の日本語エラー表示、503「承認機能は現在準備中です」。
- E2E: app.request() で list→decision→signal スタブ到達、correlation 改竄/authority mismatch 拒否テスト。
- PR #273 Codex bot P1 2件を裁定: (a) adapter 未結線は P3 Temporal スコープの既知残課題 → 返信のみ(返信確認済み)。(b) expired pending の恒久デッドエンドは妥当 → schema 無変更の supersede 方式で revise(in-place 更新+version bump で旧 correlation 無効化+approval_supersede 監査+listPending から期限切れ・NULL期限行を除外)。旧version correlation 403 / 新capability 200 の実PGテストを確認。
- 検証: red→green 証跡、実PG16 で server 全982 pass、mise test:coverage/verify:db exit 0、CI(build-test/gitleaks) SUCCESS。
- CompactionDB worker 実行は標準 waiver(CLI 不在)。consolidation は受入時にオーケストレータ実施。

## 残作業

- PR #273 の人間レビュー・マージ。
- 本番 end-to-end 開通は P3-T01(Temporal signalApprovalDecision 結線)に依存(既知・文書化済み)。
