# P8-T02-REVIEW — approve at `3d3db0c`

- task_id: P8-T02 / reviewer: claude-code-fable5-xhigh（orchestrator、adversarial）
- reviewed_at: 2026-08-16
- head_sha: 3d3db0c917120185dc30b1e22c6f09ea692c3b51
- verdict: **approve**

## 独立再検証

- guard tests 17/17・governance:check・fresh-DB `mise run ci` exit 0 を
  reviewer 環境で再実行（validation 参照）
- コード読解: `coding-agent-path-guard.mjs`（276 行）/ test（234 行）/
  composite action 骨格

## 検分（COD-001 / COD-004）

- **overlap 意味論の consume**: P8-T01 の `pathScopesOverlap` /
  `validateAgentTaskManifest` を import（再実装なし — gate と guard の
  意味論一致が構造保証）
- **無条件 forbidden**: governance（workflows/actions/CODEOWNERS/rulesets/
  agent-task contract/**guard 自身**）+ credential（`.aws` segment /
  `.env*` / `*.pem` / named 4 種）— manifest 許可でも reject
- **baseline 改竄耐性**: snapshot は HMAC-SHA256 署名（key ≥32B 必須、
  timingSafeEqual 比較）+ **repo と .git の外側にのみ保存可**（agent が
  baseline を書き換える経路を遮断）。tampered-snapshot の負 test あり
- **.git 防衛**: gitDir 自体を snapshot し hook 挿入・gitDir 差替えを検出
- **迂回パターン網羅**（17 tests）: forbidden 直接変更 / ignored credential
  投下 / ignore 規則変更による隠蔽 / .git hook / workflow 改変 /
  manifest・guard の self-modification / baseline 改竄 / rename すり替え /
  mode-only 変更 / symlink 4 変種（repo 外 escape・forbidden 先・未解決・
  ignored escape）/ manifest traversal
- **path 取扱いの堅牢性**: NUL 区切り git listing + strict 正規化
  （絶対 path・`..`・空 segment・backslash reject）、untracked +
  **ignored** ファイルも snapshot 対象（ignored 領域への credential 投下を
  検出）。hardlink 経由の編集も対象 inode の content hash 変化で検出される
- amendment 遵守: root package.json は governance:check への 1 entry のみ

## 妥当性判断

「agent は .git / credentials / governance を変更できない」を、意味論の
単一実装・改竄不能 baseline・迂回 17 パターンの機械検証で担保。
guard 自身と manifest contract を無条件 forbidden に含めた self-protection が
特に適切（P8-T04/T05 の runner 結線の前提が整った）。

---

## R01 追補（2026-08-16）

- **R01（blocking、resolved）**: clean runner で governance:check が fail —
  guard → manifest-validator → check-contracts.mjs の import chain が
  contracts workspace の `yaml` package（governance 時点で未 install）を
  引いていた構造欠陥。**本質対処 `ef9b69c`**: JSON Schema 検証を
  node: 標準のみの `json-schema-validator.mjs`（139 行）へ抽出し、
  validator/guard の governance-time chain から外部 package を排除。
  gate 順序変更・vendoring・skip は不使用。agent-task tests に
  抽出版の parity test を追加
- **reviewer clean-state 再現（記録訂正あり）**: 共有 worktree での再検証は
  worker の P7-T02 切替と競合し一部無効化された（切替後の tree に対して
  実行 — 検証主張から除外）。是正として **分離 git worktree（依存ゼロの
  素の checkout、exact head ef9b69c）**で再実証: guard **17/17**・
  agent-task **10/10**（抽出 parity test 含む）・validator の直接 import OK・
  `governance:check` **exit 0** — node_modules が一切存在しない状態での
  通過であり、rename simulation より強い clean-state 証明。full CI は
  PR #251 の clean runner を最終判定とする
- 教訓（review 定型へ追加）: governance など install 前段の gate で走る
  コードは import chain を node: 標準に閉じる。clean-state simulation
  （contracts/node_modules 退避）を該当変更の受入条件にする
- verdict: **approve at `ef9b69cc6a25`**
