# A011 acceptance record

- task_id: A011
- verdict: accepted
- reviewer: orchestrator-fable5 (claude-code)
- date: 2026-07-18
- review_source: .orchestration/validation/A011-validation.md(crit r_c8692c resolved、P1=1 是正済み)

## 検証(独立)

- **golden vector の言語非依存再実証**: docs/contracts/prjops-data.md の散文仕様のみから
  orchestrator が Python で正規化アルゴリズムを別実装し、17/17 vector で
  expected_manifest_bytes / expected_content_sha256 / expected_error_code すべて一致。
  (accept 系: manifest bytes とハッシュのバイト一致。reject 系: SYMLINK/NONREGULAR/UTF8/BOM/
  NEWLINE/NFC/UNKNOWN-PATH の先行判定コードまで一致)
- PR #105 の変更 11 ファイルはすべて docs/contracts/ 配下(plan Allowed files 内)。
  製品コード・依存変更なし。
- worker 自己レビューの P1(UUID version/variant の過剰制約、owner signature と ENV の分離不足)は
  是正済みで receipt あり。
- preflight validator --through P010-F01-T11 green(15 records)、hosted checks 全 SUCCESS。

## next_action

- PR #105 merge → ancestry 確認 → hold。F02-T02 以降は次の指示で。
