# Excel Import Guide

Excel import は GitHub Issue、Project v2 item、Milestone を取り込む。PR は対象外。

## 1. テンプレートを入手する

HTTP で取得する場合:

```text
GET /xlsx-import/template
```

CLI で生成する場合:

```bash
pnpm exec tsx packages/shared/src/xlsxImport/generateTemplate.ts aiops-import-template.xlsx
```

## 2. シートを記入する

### `issues`

| Column       | Required | Meaning                                                           |
| ------------ | -------- | ----------------------------------------------------------------- |
| `source_key` | yes      | 再実行時の同一行判定キー。                                        |
| `title`      | yes      | Issue title。                                                     |
| `body`       | no       | Issue body。実行時に `<!-- import:source_key -->` marker が付く。 |
| `labels`     | no       | カンマ区切り labels。                                             |
| `milestone`  | no       | Milestone name。                                                  |

### `project_items`

| Column            | Required | Meaning                                                    |
| ----------------- | -------- | ---------------------------------------------------------- |
| `source_key`      | yes      | 再実行時の同一行判定キー。                                 |
| `project_node_id` | yes      | GitHub Project v2 node ID。                                |
| `content_node_id` | yes      | 追加対象 Issue/PR などの node ID。                         |
| `field_node_id`   | yes      | 更新する Project v2 field node ID。                        |
| `field_type`      | yes      | 現在の engine は値を GraphQL mutation に渡すため保持する。 |
| `value`           | yes      | field value。                                              |

### `milestones`

| Column        | Required | Meaning                    |
| ------------- | -------- | -------------------------- |
| `source_key`  | yes      | 再実行時の同一行判定キー。 |
| `title`       | yes      | Milestone title。          |
| `due_on`      | no       | `YYYY-MM-DD` 形式の日付。  |
| `description` | no       | 説明。                     |

## 3. Dry-run する

```text
POST /xlsx-import/dry-run
```

レスポンスは `{ ok, rowCount, errors }`。`errors` は `sheet`、`row`、`column`、`message` を持つ。よくある `message` は次の通り。

| Message                                           | Meaning / Fix                                    |
| ------------------------------------------------- | ------------------------------------------------ |
| `sheet missing`                                   | 必要なシート名がない。テンプレートから作り直す。 |
| `unknown column`                                  | ヘッダ名がテンプレートと違う。                   |
| `required value missing`                          | 必須列が空。                                     |
| `duplicate source_key also used at <sheet>:<row>` | 同じ `source_key` が別行でも使われている。       |

入力値と未知列名は既知 secret pattern に対して sanitize される。

## 4. 実行する

```text
POST /xlsx-import/execute?owner=<owner>&repo=<repo>
Header: x-confirm-import: yes
```

確認ヘッダが無い場合は `409`。`owner` または `repo` が無い場合は `400`。

実行結果は `result.imported`、`result.skipped`、`result.failed` と行ごとの `progress` を返す。既に `import_ledger` にある `source_key` は `skipped` になる。

## 5. 再実行

同じ `source_key` の行は import ledger によりスキップされる。Issue body の import marker は人が GitHub 画面で由来を確認するための目印で、重複判定の正本は `import_ledger`。
