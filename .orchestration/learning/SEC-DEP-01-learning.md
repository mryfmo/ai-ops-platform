# SEC-DEP-01 Learning

- [memory:decision] 既存の same-major override 規約を保ち、fast-uri 3.x の floor を修正版 `^3.1.6` へ上げる。pnpm が解決した 3.1.7 で high advisory 4件が消え、lockfile の変更も fast-uri だけに限定できた。
- [memory:failure] advisory database の更新で、無関係な作業ブランチを含む全 CI が audit 段階から止まることがある。依存変更が元タスクで禁止されている場合は、その場で lockfile を触らず、独立した dependency fix を先に landing してから元ブランチへ取り込む。
- full CI の DB は毎回 fresh cluster を使う。途中まで走った DB を再利用すると、schema 状態の衝突をタスク差分の失敗と誤認しやすい。

CompactionDB decision: `fc275cb7-9c22-4dea-9b0a-90feff105bea`

既存の dependency override と fresh-DB CI の運用に収まる知見なので、共通ルールへの追加提案はしない。
