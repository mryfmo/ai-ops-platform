# P2-T02 learning

- Apple container の既定メモリ 1GiB では LiteLLM v1.96.2 が boot 中に OOM Kill され
  「ログ無しで即 stopped」になる。無ログ停止はまず OOM を疑い、-m 4g で切り分ける
  （rule_candidate 化はしない: smoke.sh に SMOKE_MEMORY 既定 4g として恒久化済み）
- `container` の stopped buildkit builder が 25GiB を保持し続けてディスクを圧迫し得る。
  smoke 前に `df` と `container list --all` を確認し、不要 builder は削除してよい
  （build 時に自動再作成される）
- ghcr/docker.io への `container image pull` は一過性の connectTimeout を起こす。
  ホスト curl で疎通確認のうえ単純リトライで解消
