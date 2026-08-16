# P5-T01-REVIEW — approve at `c5d0042`

- task_id: P5-T01 / reviewer: claude-code-fable5-xhigh（orchestrator、adversarial）
- reviewed_at: 2026-08-15
- head_sha: c5d00426908dd453d6541259b5ee1d4f2b1712ab
- verdict: **approve**

## 独立再検証

- `@aiops/integrations` 48/48（新規 workIqTokenClaims 含む）を再実行
- fresh-DB `mise run ci` exit 0（reviewer 環境で単独判定 — validation 参照）
- 反証プローブ 11 種（built dist、全て仕様どおり reject / accept）:
  app-only（roles-only / scp 空）→ E-WIQ02、scope 過剰・case 変形 → E-WIQ07、
  cross-tenant tid → E-WIQ04、他 tenant issuer / common issuer → E-WIQ03、
  audience 不一致 → E-WIQ05、subject 欠落 → E-WIQ06、
  expectedTenantId 非 UUID → E-WIQ01。正常 delegated（空白許容）のみ accept

## 妥当性判断

- **app-only rejected（WIQ-001 の設計面）**: client credentials 形
  （roles のみ・scp 欠落）は必ず reject。issuer を expected tenant から構築する
  ため common/organizations endpoint も構造的に排除（ADR-0024 の
  「application-only fallback 禁止」を型と検証で固定）
- **least scopes documented**: 単一 resource scope `WorkIQAgent.Ask` の
  exact-match 許可 + operation 粒度は platform 側（registry/OPA）で統制する
  設計が contract に文書化。scope 追加は contract 改訂 = レビュー経由
- contract 文書は 6 段 token flow の各段 fail-closed・cache 分離キー・
  admin consent plan・gateway conformance（app-only 化した下流 token の拒否）
  を網羅。実資格情報・実 tenant ID なし（placeholder 形式、gitleaks も CI 検証）
- スコープ遵守（amendment 含む）、#236 対象ファイル非接触、依存追加なし

## Note（実 tenant 到達後）

- WIQ-001/005 の実 tenant E2E（app-only rejected の live 実証・
  multi-tenant negative）は sandbox-m365 到達後の後続タスクで実施
  （本タスクの verification は WBS どおり design/token-flow tests）
