# CHORE-HYG-01 Report

`agent/CHORE-HYG-01` で traceability matrix の非決定性と鮮度漏れを直し、`aiops-pr-bot` の権限説明を実測値へ合わせた。実装 commit は `e115331`、最新 `origin/main` を取り込んだ現在の HEAD は `e38182f`。

## 変更内容

- matrix から壁時計の生成日時を外し、「この生成物はコミット時点のリポジトリ状態を反映する。」という固定文へ置き換えた。不要になった `now` オプションも削除した。
- 固定文が含まれ、`生成日時:` が含まれないことを回帰テストで押さえた。
- `.mise.toml` の既存 traceability task に `git diff --exit-code -- packages/traceability/output/traceability_matrix.md` を足した。新しい仕組みや依存は増やしていない。
- matrix は generator だけで再生成した。
- `runbooks/ai-pr-identity.md` から Issues write を削除した。正しい3権限は contents write / pull_requests write / metadata read。PR #291 では pull_requests write だけで label 付与が成功している。

## 検証結果

- focused test: 130/130 成功。
- `mise run traceability`: 2回連続で exit 0。2回目も matrix 差分なし。
- stale matrix RED: index 上の1行を意図的に古くすると、generator 後の `git diff --exit-code` が差分を出して exit 1。その直後に generator 出力を stage し直し、index と worktree の両方を復元した。
- `mise run ci`: fresh PostgreSQL 16 cluster（localhost:55524）で exit 0。最後まで `P001 PostgreSQL integration passed` を確認した。high audit は0件、残る4件は moderate。
- ローカル Crit data の review-scope approval record `r_795fbb` を resolve 済み。証跡は `.agents/worklog/codex/review/CHORE-HYG-01-crit-comments.json`。

## 連続マージ時の扱い

この gate が鮮度を保証するのは、現在の branch または merge commit 上で traceability が再実行された場合に限る。IDや参照は削除もあり得るため、集合や集計値が常に単調に増えるとは断言できない。base が動いた後も古い green 判定のまま merge できる運用では、gate だけで main の鮮度は保証できない。

そのため branch protection の「最新 base を取り込んでから merge」か merge queue で、現在の統合 commit に対して CI を再実行する必要がある。今回は #288/#290 と SEC-DEP-01 を含む最新 main を取り込んだ後に traceability 2回と全CIを通し、組み合わせ後の状態まで確認した。

## CompactionDB

実行コマンド:

```bash
python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project --content 'CHORE-HYG-01: traceability matrix output must remain deterministic by omitting wall-clock and commit-hash provenance. The mise traceability task regenerates the matrix and then runs git diff --exit-code on the tracked output. Freshness therefore depends on rerunning CI on the current integration commit; require up-to-date branches or a merge queue after base movement. aiops-pr-bot permissions are contents:write, pull_requests:write, and metadata:read; Issues permission is unnecessary for PR labels as measured on PR #291.'
```

memory id: `3cd8ca44-01af-4c63-8c06-ee635108b57a`

cost: n/a
