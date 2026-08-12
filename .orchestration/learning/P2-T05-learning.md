# P2-T05 learning

- @anthropic-ai/sdk 0.115 は custom fetch が投げた例外を APIConnectionError
  ("Connection error.") に包んで再試行する。fetch 層のガードをテストする際は
  例外メッセージではなく「実 fetch が呼ばれない」ことを保証点にする
- 語彙ドリフト防止は「テストが正典ファイルを直接読む」形が最小で強い
  （shared → deploy/litellm/model-aliases.yaml の anchor 行を抽出して deepEqual）
