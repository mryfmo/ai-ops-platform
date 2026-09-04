# SEC-DEP-01 Report

`agent/SEC-DEP-01` で fast-uri の high advisory 4件を解消した。変更は `pnpm-workspace.yaml` の override 1行と、対応する `pnpm-lock.yaml` の fast-uri 解決だけ。commit は `b433a6e6afb9257663d0dc9fb6a154d7408ef36b`。

## 変更内容

- `fast-uri@3` の override floor を `^3.1.5` から `^3.1.6` へ更新した。
- pnpm 11.13.0 が fast-uri 3.1.7 を解決した。lockfile で変わったのは override、package resolution、AJV の参照、snapshot の4箇所だけだった。
- package.json や他の依存関係には触れていない。

## 検証結果

- RED: fast-uri 3.1.5 では high 4件、moderate 4件で `pnpm audit --prod --audit-level high` が exit 1。
- GREEN: 更新後は moderate 4件だけになり、同じ high threshold の audit が exit 0。
- `mise run ci`: fresh PostgreSQL 16 cluster（localhost:55522）で exit 0。最後まで `P001 PostgreSQL integration passed` を確認した。
- ローカル Crit data を読み、fast-uri 限定差分を approval record `r_571819` として resolve 済み。証跡は `.agents/worklog/codex/review/SEC-DEP-01-crit-comments.json`。

moderate 4件は今回の high advisory 4件とは別で、タスク範囲外。依存変更を広げず、そのまま残した。

## CompactionDB

実行コマンド:

```bash
python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project --content 'SEC-DEP-01: Keep the existing fast-uri@3 workspace override on the patched same-major floor ^3.1.6; pnpm currently resolves 3.1.7, removing GHSA-5jgf-p345-68v8, GHSA-f65p-4m7j-42xc, GHSA-fph4-wmhf-6fwf, and GHSA-jqff-g426-hqxp from the high-severity production audit without changing other dependency resolutions.'
```

memory id: `fc275cb7-9c22-4dea-9b0a-90feff105bea`

cost: n/a
