# P4-T03 OPA Decision Client and Bundle

## 概要

P1-T03 の default-deny Rego を versioned OPA bundle として配布できる構成と、応答を厳格検証して全障害を deny に正規化する DI 対応 TypeScript client を追加した。OPA deployment 宣言は license/environment gate が OPEN のため `enabled: false` の preparatory configuration とし、production runtime への結線は行っていない。

## 根拠となる仕様ID

- FinalArch:MCP-002
- FinalArch:CON-004
- ADR-0023
- WBS P4-T03

## Delivered

- `OpaDecisionClient`: injected `FetchLike`、2 秒 timeout、最大 2 回の有限 retry、HTTP/network/timeout/malformed 応答の E-code 付き fail-closed deny。
- strict response boundary: allow / deny / require_approval、obligations、UUID decision ID、expected bundle revision を検証。未知 field・bundle drift・不正 JSON は deny。
- caller token/header passthroughを持たない固定 POST request。返り値は成功・失敗を問わず `policyBundleVersion` を保持。
- OPA Rego v1 bundle builder: production module/data のみを含め、`.manifest.revision=0.1.0` を検証。
- OPA `v1.19.0-static` OCI index digest pin、internal-only address、外部 version check 無効化、masked stdout decision log。
- runtime smoke: pinned image 上で unknown MCP tool が `default_deny` / bundle `0.1.0` を返し、caller input が log に出ないことを実測。

## Security and Operations Posture

- default deny は維持し、未登録 tool・catalog 外 risk・input 欠落を Rego test で固定した。
- `data.system.log.mask` が `/input` 全体を decision log から除去する。OPA 自身に telemetry egress は設定せず、stdout を platform OTel collector が扱う前提のみを宣言した。
- image: `docker.io/openpolicyagent/opa:1.19.0-static@sha256:2f42ca765bb739b40fc23ee625b3287012acdf8120ad4fcbdab68433a17be144`
- OPA image/dependency/Apache notice review は OPEN。Owner/Security gate 前は `enabled: false` を変更しない。
- rollback は本 PR の revert と last-known-good bundle の保持。署名・promotion・runtime wiring は後続 gate の範囲。

## Validation Summary

- `mise run policy:rego`: PASS 16/16。
- policy unit: PASS 2 files / 11 tests。
- bundle build/inspect: PASS revision `0.1.0`, Rego v1, test module/workstation path なし。
- OPA container smoke: PASS default deny、version、masked log。
- fresh disposable DB 3 件を再作成後の `mise run ci`: exit 0。

## チェックリスト

- [x] 新規/変更ファイルの先頭に根拠IDヘッダを記載した
- [x] 根拠IDの要求内容をテストで示した（`FinalArch:MCP-002`）
- [x] `mise run ci` が fresh DB でローカル green
- [x] 秘密情報（APIキー・トークン・接続文字列）が差分に含まれていない
- [x] decision client の外部 I/O は注入可能で、ネットワークなしの unit test を追加した
- [x] 外部作用は追加していない。production configuration は non-enabled
- [x] schema.sql 変更なし
- [x] AI生成 PR（task_id `P4-T03`、branch `agent/P4-T03-opa-decision-client`）

## Review Focus

- strict response parsing と bundle-version drift の fail-closed 境界
- retry が timeout/network/5xx に限定され、3 回以下で bounded であること
- OPA bundle provenance、default deny、decision log input mask
