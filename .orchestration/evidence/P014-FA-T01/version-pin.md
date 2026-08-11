# P014-FA-T01 実行基準・upstream inventory(orchestrator 実施)

- 実施: orchestrator-fable5, 2026-07-19(すべて read-only の gh api readback)
- 判定: **PASS — STOP 条件非該当**。承認対象 version を以下に固定する。

## 承認対象 version(mutable 参照ゼロ)

- Plane CE release: **v1.3.1**(published 2026-05-14T20:16:06Z)
- tag commit: `d0a4adc55bb1fa5b8c221c0c680b992d2677e9c5`
- setup assets(release 添付、sha256 digest):
  - docker-compose.yml `d4cefab6a281a07495713ffac4bdeec206476bff8718d30f9ea67076c7a415f0`
  - setup.sh `466b2e0d6137f72b577e10bd8af20a1f5c11268fc1294445fed7571c99d40031`
  - variables.env `b0e63dbf27c3435061445d29ce2c3e9372ee3c3b437e936e27d955065844ea3b`
  - restore.sh `916d813af9271d50d0fa05c057c9df2025a2ff15d9af3028b055605052e5ee1e`
  - restore-airgapped.sh `cefb338d144ddd6feb590fb5fbcf9796c6c59dbf8dc445b4c4ba203e467ba42f`
  - swarm.sh `7189f1dc0a2e7f9ce9a96e76cbd658e9a542793984b692920805b5f3fc22cf50`
- LICENSE.txt @ v1.3.1: git blob `5087e61e24bce453516dd67d07aec21923271472`(34,516 bytes、AGPL-3.0)
- 公式 docs(参照日 2026-07-19): developers.plane.so(self-hosting / api-reference / intro-webhooks)、
  API version `/api/v1/`

## security advisory readback(published 全件)

| GHSA | severity | 要旨 | patched |
| --- | --- | --- | --- |
| GHSA-qw87-v5w3-6vxx | high | cross-workspace **asset** authorization bypass | **1.3.1** |
| GHSA-93x3-ghh7-72j3 | medium | ORM field injection (saved analytics) | **1.3.1** |
| GHSA-9fr2-pprw-pp9j | high | SSRF (favicon redirect) | 1.3.0 |
| GHSA-4q54-h4x9-m329 | medium | IDOR cross-project bulk update | 1.3.0 |
| GHSA-fpx8-73gf-7x73 | high | SSRF (webhook URL serializer) | 1.2.3 |

→ 既知 advisory はすべて v1.3.1 以下で patched。「known critical advisory 未修正」STOP は非該当。

## #5757 readback

- issue #5757「One API key can read other workspaces data」: **state=open**(最終更新 2024-10-13)。
  修正リンクなし。GHSA-qw87(1.3.1 で修正)が同系統(cross-workspace 認可)である事実は、
  この脆弱性クラスが実在し得ることの傍証 — **P014-FA-T03 の negative probe は必須のまま**。

## owner 割当(FA-T01 Complete 要件)

- version/digest 承認: mryfmo(ADR-0019 owner 承認 2026-07-19 に基づく)
- upgrade owner / rollback owner: mryfmo(dev-phase。go-live 前に運用 owner を正式指名)
