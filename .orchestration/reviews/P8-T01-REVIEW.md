# P8-T01-REVIEW — approve at `eb373e6`

- task_id: P8-T01 / reviewer: claude-code-fable5-xhigh（orchestrator、adversarial）
- reviewed_at: 2026-08-16
- head_sha: eb373e604f561a12f54663b3c9de273a3ae0627a
- verdict: **approve**（note 1 件）

## 独立再検証

- contracts `agent-task` 9/9 再実行（valid 受理 + 負 fixture 8 系:
  writer==reviewer / 未知 role / profile label 形式 / allowed×forbidden 重複 /
  glob 形式 / budget 欠落・非正値 / 他 task branch / callback 不完全 /
  unpinned runner / master・provider key・production network / 並行 writer の
  path 交差 / task・branch 重複 / disjoint 受理）
- **overlap semantics の reviewer プローブ**: `a/**` vs `ab/c` の
  prefix-collision を正しく非重複と判定（`startsWith(base + "/")` — naive
  prefix 判定の典型バグなし）、nested scope（`pkg/a/**` ⊃ `pkg/a/b/**`）の
  検出と無関係 task の非誤検出を実測
- **disjointness**: open PR #244/#245/#246 の変更ファイルとの重複 **0**
  （機械確認）。server の app.ts/index.ts 非接触の指示遵守

## 検分（COD-003 schema 面）

- schema（222 行）: writer/reviewer 固定 slot・execution profile label は
  形式検証のみ（**capability assumption のハードコードなし** — canon 準拠）、
  budget（runtime/cost/tokens/tool calls）必須・正値、runner は pinned
  CLI/digest 必須、master/provider key・production network の否定表現、
  callback 必須項目（canon の Task completion callback 列挙と一致）
- One Writer: manifest 単体検証（role 整合・branch は task 帰属）+
  複数 manifest 間の pairwise 交差（task/branch/path の 3 種 conflict）で
  concurrent claim を reject — **agmsg レジームの disjointness 運用が
  そのまま機械 gate になった**
- CI 結線は contracts gate（既存 build-test 経由）— 確立パターンどおり。
  `.github/` 新設 workflow は不要と判断（task の「または」分岐）

## Note

1. server 側の型/結線は未着手（並行 open PR との衝突回避のため task 指示
   どおり後続へ分離）。P8-T02 以降で manifest を消費する際に結線
