<!-- 根拠: FinalArch:MCP-002 / FinalArch:CON-004 / ADR-0023 / WBS P4-T03 -->

# OPA decision service bundle

P1-T03 の default-deny policy を OPA v1 bundle として配布し、P4-T03 の
decision client が `POST /v1/data/aiops/policy/decision` を呼び出すための準備構成。

> OPA の Apache notice・依存 license review と環境 gate は OPEN。本成果物は
> **non-enabled preparatory configuration** であり、Owner/Security 裁定前に
> runtime から参照・起動しない。

## 不変条件

- `build-bundle.sh` は test package を除外し、`policy.rego` の
  `bundle_version` を `.manifest.revision` に設定して Rego v1 metadata を検証する
- image は `deployment.yaml` の tag + OCI index digest に完全固定する
- OPA port は internal-only。host port や public ingress を公開しない
- decision log は `system.log.mask` で caller input 全体を除去して stdout へ出し、
  runtime collector が platform OTel pipeline へ転送する。OPA の直接 egress はない
- `--skip-version-check` で起動時の外部 version check を無効化する

## 検証

```bash
mise run policy:rego
pnpm --filter @aiops/policy run test
./deploy/opa/build-bundle.sh
./deploy/opa/smoke.sh
```

rollback は task PR の revert と last-known-good bundle の保持。署名付きbundleへの
promotionとruntime結線は後続の承認済み production gate で行う。
