# P7-T05-REVIEW — approve at `994e23d`

- task_id: P7-T05 / reviewer: claude-code-fable5-xhigh（orchestrator、adversarial）
- reviewed_at: 2026-08-17
- head_sha: 994e23d799b107f55faf3fff4591cf22afc05431
- verdict: **approve**

## 独立再検証

- server 942 / channel-teams 40 再実行、DB-less coverage 通過、
  fresh-DB `mise run ci` exit 0（validation 参照）
- コード検分: `approvalCard.ts`（版付き card + 署名 correlation）/
  `approvalsRepo.ts`（**pending+version+unexpired の単一 CAS**、
  version 不一致は専用 error）/ `routes/approvals.ts`（135 行 evolve）

## 検分（UX-002 — 裁定との一致）

- **only authorized reviewer**: 署名済み Entra identity を card correlation に
  束縛し、押下時に一致検証 + 毎リクエスト recipients/project authorization
  （option (a) 裁定どおり）。不一致は**一様 403 + 監査**。
  **自己承認（decider = requested_by）も 403 + 監査**（追加条件の遵守）
- **stale card rejected**: version 付き card × 単一 DB CAS
  （pending+version+unexpired）で stale/replay/expiry/二重押下を構造遮断。
  CAS 競合は 409（decided 済みも 404 に潰さず 409 — 状態の誠実な報告）
- **順序保証**: signal port 未結線 → **CAS 前に 503**（approval を消費せず
  fail-closed）/ CAS 成功後の signal 障害 → 503 で**外部確定を返さない**
  （P3-T03 の authoritative-read 回復系と整合）。
  CAS receipt × approvals authority の id/version/status 一致を signal 前に
  照合（P4-T04 パターン継承）
- signal port は P3-T03 payload 形を消費する必須注入（bare signal なし・
  契約再実装なし）。positive composition test（結線時に signal 到達）あり。
  body 上限は認証前に 413（DoS 面）
- Teams approval E2E は tenant 到達後 deferred と validation に明記

## 妥当性判断

「card は UI、確定は authority + workflow」という canon の分離を、
identity 束縛 correlation・単一 CAS・順序保証・自己承認禁止で実装。
裁定 3 点が正確に反映され、失敗時に外部確定を漏らさない点も P3 規範どおり。
