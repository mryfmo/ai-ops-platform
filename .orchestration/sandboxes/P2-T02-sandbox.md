# P2-T02 sandbox

- container smoke は Apple `container` CLI 1.2.2 の VM 分離で実行
  （litellm pinned digest + postgres:16-alpine sidecar、192.168.64.0/24 内部網、
  ホスト公開ポートなし、実 provider 資格情報なし = dummy env のみ）
- OpenSandbox は不使用（コンテナ VM 分離が同等の隔離を提供する fallback 記録）
- 使い捨て資源はすべて破棄済み（litellm-smoke / litellm-smoke-db / litellm-ev 削除、
  fresh DB aiops_p001 は使い捨てクラスタ 55432 上）
