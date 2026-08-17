# P10-T05-REVIEW — approve at `542c844`

- task_id: P10-T05 / reviewer: claude-code-fable5-xhigh（orchestrator、adversarial）
- reviewed_at: 2026-08-17
- head_sha: 542c844c0e5e4960cd1990d30570718a36cf7c3f
- verdict: **approve**

## 独立再検証

- contracts deploy-workflow **9/9** 再実行。負 fixture の網羅を検分:
  floating action / mutable tag / 任意 build path / long-lived AWS
  credential 参照（全変種）/ OIDC 欠落 / tag-scan SBOM / build と切離された
  provenance / tag deploy / Environment approval 欠落 / 0-10-50-100 gate の
  skip・順序入替 / 非 failure 条件の rollback / AWS 呼出前の mutable image
  （reviewer 自作プローブは module 解決で不成立 — suite の負 fixture が
  同等以上を網羅しているためそれを検証根拠とする）
- `release-image.yml` の実検分: **全 action SHA pin**（checkout /
  configure-aws-credentials / ecr-login / buildx / build-push / sbom-action /
  cosign-installer / attest-build-provenance — version コメント付き）
- disjointness: open PR #255 変更ファイルとの重複 **0**（機械確認）
- fresh-DB `mise run ci` exit 0（reviewer 環境単独判定）

## 検分（REL-003 の構造面）

- **digest deploy**: validator が `:latest`/tag 参照を serialized 全文で
  reject、SBOM は `steps.digest.outputs.image-ref` の**完全一致**でのみ
  scan 可、signature/provenance も build digest への束縛を強制
  （「同じ digest の別名」への差し替えも不可）
- **OIDC のみ**: long-lived AWS credential 参照は全変種 reject
- **staged rollout**: staging → Environment approval → canary 0/10/50/100 の
  順序固定（skip/入替 reject）、rollback は failure 条件 + 直前 immutable
  digest の消費を強制。`ecs-release.sh`（287 行）+ rollout runbook
- 実 staging 実測は AWS 到達後の deferred（REL-003 残余 — 既存 gate と同一）

## 妥当性判断

supply-chain（SHA-pin/digest/SBOM/provenance/署名）と rollout 統制を
「workflow 定義の機械検証」に落とし込み、P8-T06 の validator パターンを
一貫継承。acceptance 3 点を構造検証 + runbook + deferred 明記で充足。
