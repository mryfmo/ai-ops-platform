# P3-T01 learning

- temporalio/auto-setup の TLS は server 側 env だけでは不完全: internal system worker と
  新 temporal CLI（namespace 登録）用に FRONTEND_CERT/KEY・CLIENT1_CA_CERT・
  TEMPORAL_TLS_CA/CERT/KEY/SERVER_NAME を併せて渡す必要がある（不足すると
  「first record does not look like a TLS handshake」で boot 失敗）
- IP 直指定接続では serverNameOverride + SAN 規約名で TLS 検証を維持する
- bash 3.2（macOS）の set -u は空配列展開で落ちる → ${arr[@]+"${arr[@]}"} 形で保護
- prettier は .terraform の provider バイナリを読んで Invalid string length で落ちる →
  .prettierignore に **/.terraform/ を置く

## L-P3T01-04: shared worktree の branch flip は「revert 済み」報告と push head を乖離させる

- 事象: pnpm-workspace.yaml の revert を worktree 上で実施・検証したが、reviewer の branch
  切替後の tree に対して行っていたため、push した head には残存。round-4 update で虚偽になった。
- 規則: 「fixed」と報告する前に、worktree 状態ではなく **push 対象 head の merge-base diff**
  （`git diff origin/main...<branch> -- <file>`）で不在を確認する。worktree grep は証跡にならない。
