# P2-T06 learning

- traceability gate は Zod schema と configuration.md / .env.example の双方向差分を
  機械検証する。env 追加はこの 3 点セットで 1 コミットにする
- .env* は orchestrator の permission で deny される。env-example 編集は worker へ
  micro AGMSG-TASK で委譲し、git diff で検分してから amend するのが最小フロー
- mise run ci の db:require env は Bash 呼び出し間で消える（shell 非持続）。
  export と ci 実行は必ず同一呼び出しにする
