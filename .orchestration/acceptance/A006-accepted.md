# A006 acceptance record

- task_id: A006
- verdict: accepted
- reviewer: orchestrator-fable5 (claude-code)
- date: 2026-07-18
- review_surface: crit-data + adversarial re-derivation(orchestrator 自身による攻撃再現)
- review_source: .orchestration/validation/A006-validation.md(crit 自己レビュー resolved 1 / unresolved 0)

## 敵対的検証(orchestrator 実施・全件実測)

green: `--through P010-F01-T09` exit 0、DEV-TRUST 警告の強制表示を確認。
`--final` は 13/86 記録で exit 1(missing task)を確認。

攻撃 10 種(すべて実際に改竄 manifest を作成して実行、全件 exit 1 + 具体的エラー):

| # | 攻撃 | 結果 |
|---|---|---|
| 1 | reviewer=requester の自己承認 | ERROR: requester cannot review its own record |
| 2 | artifact sha256 改竄 | ERROR: artifact hash mismatch |
| 3 | artifact path を repo 外へ | ERROR: artifact path is outside repository |
| 4 | review evidence sha の自作値 | ERROR: review evidence hash mismatch |
| 5 | status=BLOCKED | ERROR: status must be ACCEPTED |
| 6 | command exit を 1 に | ERROR: nonzero command |
| 7 | plan pin(immutable hash)改竄 | ERROR: plan hash mismatch |
| 8 | 未来 task T10 の偽 record 追加 | ERROR: extra task P010-F01-T10 |
| 9 | record 重複 | ERROR: duplicate task |
| 10 | record 順序入替 | ERROR: task out of order |

## scope 検証

- PR #100 のファイルは plan Allowed files と完全一致(scripts/tests/verification + package.json の
  script entry 1 行のみ)。依存追加なし。
- T10 自身の record は含まれない(自己参照禁止の遵守)。
- hosted build-test / gitleaks / CodeRabbit SUCCESS。

## next_action

1. PR #100 merge。
2. merge 後、T10 acceptance record は plan の規定どおり **orchestrator が内容を確定**し、
   ワーカーは orchestrator 提供のバイト列をそのまま追加・PR する(derivation 権限の分離を維持)。
