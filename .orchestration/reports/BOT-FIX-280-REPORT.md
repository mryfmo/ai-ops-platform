# BOT-FIX-280 Report

## Outcome

- Jira runtime を `main()` の DI seam で env-gated に結線した。mapping + bearer 設定時は webhook と event dispatch、site + OAuth 設定時は snapshot task を構成し、対応する backend が未注入なら起動を拒否する。
- Jira sync identity に event `revision` を追加し、workflow/business/idempotency key の全経路へ含めた。revision は webhook と snapshot が共通に持つ `updated` の ISO 正規形と `fieldHash` を改行で連結し、SHA-256 化する。payload 全体へ依存せず同一 issue の世代を分離でき、64文字 lowercase hex のため business key の制約（500文字以内、`/` 禁止）も維持する。
- JQL pagination は `isLast === true` のみ正常終端とし、それ以外で有効な `nextPageToken` がない応答を `E-JIRA-MALFORMED` にした。
- production mapping は `provenance.signature` を除外した再帰 key-sort canonical JSON を Ed25519 で検証する。owner 公開鍵は PEM または base64-SPKI を受け付ける。
- 新規 `JIRA_*` 5項目を設定台帳へ追加した。これは `fix1-config-inventory` の AGMSG-ANSWER で許可された最小変更である。

## Runtime prerequisite

deployment composition は ADR-0030 の Temporal `jira-sync` client を `main()` の `dispatchJiraEvent` と `commitCompleteSnapshot` へ注入する必要がある。server package は control-plane/Temporal へ依存しない。Jira env 未設定時は従来どおり webhook route 503、snapshot 未登録である。

## Validation

- Focused tests: server 94、control-plane state 8、integrations 6、mapping validator 7、replay 23、すべて pass。
- Recorder で Jira replay fixture 18件を再生成し、手編集していない。
- fresh PostgreSQL cluster で `mise run ci` exit 0。P001 PostgreSQL integration まで pass。
- `make require-crit-review` は repository に target がなく、`No rule to make target` で終了したため Crit review は開始されなかった。

cost: n/a（ローカル実装・検証のみ。LLM API、実 Jira/GitHub 接続なし）

[memory:decision] Jira runtime は server の DI 境界を維持し、JIRA_* 設定と backend 注入の不整合を startup fail-closed にする。revision は canonical updated timestamp + fieldHash の SHA-256 とする。

[memory:failure] pnpm 初回 bootstrap の並列実行は store purge 判定が競合したため、`CI=true` で逐次実行した。全 CI は fresh PostgreSQL cluster で再実行した。

CompactionDB decision command:

```bash
python3 .claude/hooks/contextdb_cli.py memory add --kind decision --scope project --content 'BOT-FIX-280: Jira runtime remains dependency-inverted: server main() accepts deployment-injected Temporal jira-sync dispatch and snapshot-commit seams, and configured JIRA_* gates fail startup when either backend is absent. Per-event revision is SHA-256 of canonical updated timestamp plus fieldHash and participates in workflow, business, and idempotency identity.'
```

Decision ID: `ece271c9-2dce-4e31-98c3-5e937d8b53d5`
