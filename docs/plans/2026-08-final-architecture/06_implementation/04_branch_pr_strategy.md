# Branch / Pull Request Strategy

## 1. 基本規則

- 1 WBS task = 1 branch = 原則1 PR。
- branch名: `agent/<task-id>-<slug>`。例: `agent/P2-T04-migrate-server-llm-client`。
- WriterはWBSで固定。Reviewerは別モデルまたは人間。
- 同一branchをClaude CodeとCodex/Droidが同時編集しない。
- mainへの直接push、自動merge、force-push、history rewriteは禁止。
- PRは小さく、契約・実装・テスト・文書を同一タスクの範囲で完結させる。

## 2. PRの必須内容

1. WBS task ID、spec/ADR/AC ID。
2. 変更理由と非変更範囲。
3. 変更path一覧。
4. migration/feature flag/rollback。
5. 実行したcommandと結果。
6. 実行できなかった検証と理由。
7. security/data classification影響。
8. dependency/SBOM差分。
9. Reviewer findingsへの対応表。

## 3. PR順序

```text
contract PR
  -> skeleton/adapter PR
  -> shadow implementation PR
  -> E2E/negative evidence PR
  -> flag enablement PR
  -> old-path removal PR
```

同じPRで「新経路導入」と「旧経路削除」を行わない。rollback可能性を失うためである。

## 4. Shared path coordination

以下は競合しやすいため、同時Writerを1人に制限する。

- `packages/shared/src/index.ts`
- `packages/server/src/config.ts`
- `.env.example`
- `packages/devops/src/db/schema.sql` / migrations
- `.github/workflows/ci.yml`
- `docs/spec/spec-id-catalog.md`
- `packages/traceability/spec-ids/*.json`
- root `package.json`, `pnpm-lock.yaml`, `.mise.toml`

## 5. Review protocol

- Reviewerはbase SHAとhead SHAを固定してレビューする。
- Findingにはseverity、path、line、 violated ID、evidence、required fixを付ける。
- Writerが修正後、新head SHAでre-reviewする。
- Reviewerが直接修正する場合は、task ownershipを明示変更し、handoff recordを作る。
- Architecture disagreementはコードで解決せず、ADR/Owner decisionへエスカレーションする。

## 6. Merge gate

- required CI green
- CODEOWNERS approval
- unresolved high/critical findings = 0
- migration/rollback verified
- feature flag default-safe
- traceability green
- secrets/SBOM/license checks green
- real-environment gateが必要なPRはevidence URL必須

## 7. Emergency exception

緊急修正でもmain直接pushは禁止。break-glass branch + minimum two-person approval +事後24時間以内のRCA/ADR/テスト補完を必須とする。
