# BOT-FIX-289B Acceptance

- task_id: BOT-FIX-289B
- status: accepted
- date: 2026-09-05
- reviewer: claude-deep-dot (orchestrator)
- commit: 54f4e6555d6fc494a79bcff9f2ed71e4666a4069 (branch agent/BOT-FIX-289B)
- cost: n/a (worker-reported)

## Review

- 名前付き catch の組み込み Error 再 throw 全5箇所（composition/runtime.ts:40, devops/AGT_RPT.ts:140, server/config.ts:591, server/index.ts:269, web/server/config.ts:178）へ `{ cause }` 付与。コンストラクタ・メッセージ・分岐不変
- 掃引の網羅性: TypeScript AST 列挙+**ローカル ESLint core 10.9.1 に preserve-caught-error を強制指定**（依存変更なし）で変更前5件 RED→変更後0件 GREEN を直接実証 — #289 CI 委任前提を上回る検証
- sanitizer 境界（設計原則4）: 各箇所で cause の外部流出経路なしを確認（AGT_RPT は JSON spread で非列挙 cause が本文へ乗らないことをテストで固定）
- cause 同一性の回帰テスト追加。focused（composition16/devops13/server78/web12）+ fresh PostgreSQL `mise run ci` exit 0
- CompactionDB decision c0ec5cbd-23d7-430f-ad4c-8354c165da5c を DB 直接確認

cost: n/a
