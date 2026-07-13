# Excel Import Guide

Excel import は GitHub Issue、Project v2 item、Milestone を取り込む。PR は対象外。

## 1. テンプレートを入手する

認証後、ダッシュボードの「Excel取込」（`/app/dashboard/xlsx-import`）からダウンロードする。公開の
`GET /xlsx-import/template` は廃止され、未署名アクセスは `401` になる。

CLI で生成する場合:

```bash
pnpm exec tsx packages/shared/src/xlsxImport/generateTemplate.ts aiops-import-template.xlsx
```

テンプレートには `_metadata` シートの `template_version` が自動設定される。このセルは変更・削除しない。古い版、版数欠落、未知の版は `E-XLS-001` でファイル全体が拒否されるため、配布エンドポイントから最新版を取り直す。

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

通常は認証後のダッシュボードでファイルと対象 GitHub owner/repository を選び、「dry-runで検証」を押す。全エラーを解消後、確認チェックを入れた場合だけ実行できる。ブラウザはファイルだけを WebUI へ送り、`XLSX_IMPORT_SECRET` は WebUI サーバーサイドが保持して raw bytes を HMAC-SHA256 署名する。

UI を利用できない場合は、シークレットへアクセスできるエンジニアが次の CLI 手順を代行する。推奨ヘッダは `x-aiops-signature-256: sha256=<lowercase hex>`（互換用に `x-hub-signature-256` も受理）。シークレットをコマンド引数や標準出力へ展開しない。

```bash
export AIOPS_BASE_URL=https://aiops.example.com
export XLSX_FILE=aiops-import-template.xlsx
# XLSX_IMPORT_SECRET はシークレットストアから環境変数へ設定済みとする。

SIGNATURE="$(
  node --input-type=module -e '
    import { createHmac } from "node:crypto";
    import { readFileSync } from "node:fs";
    process.stdout.write(createHmac("sha256", process.env.XLSX_IMPORT_SECRET).update(readFileSync(process.env.XLSX_FILE)).digest("hex"));
  '
)"

curl --fail-with-body \
  -H "content-type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" \
  -H "x-aiops-signature-256: sha256=${SIGNATURE}" \
  --data-binary "@${XLSX_FILE}" \
  "${AIOPS_BASE_URL}/xlsx-import/dry-run"
```

レスポンスは `{ ok, rowCount, errors, summary }`。`summary` は受理行数とエラーを固定順で示す人間可読文字列。`errors` は `sheet`、`row`、`column`、`code`（該当時）、`message` を持つ。よくあるエラーは次の通り。

| Code / Message                                    | Meaning / Fix                                                        |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| `E-XLS-001`                                       | テンプレート版が欠落または不一致。最新版からファイル全体を作り直す。 |
| `sheet missing`                                   | 必要なシート名がない。テンプレートから作り直す。                     |
| `unknown column`                                  | ヘッダ名がテンプレートと違う。                                       |
| `required value missing`                          | 必須列が空。                                                         |
| `duplicate source_key also used at <sheet>:<row>` | 同じ `source_key` が別行でも使われている。                           |

入力値と未知列名は既知 secret pattern に対して sanitize される。

ファイル上限は 10 MiB。`XLSX_IMPORT_SECRET` 未設定は `503`、署名欠落・不一致は `401`、上限超過は body の読み込み完了前に `413` となる。

## 4. 実行する

```bash
curl --fail-with-body \
  -H "content-type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" \
  -H "x-aiops-signature-256: sha256=${SIGNATURE}" \
  -H "x-confirm-import: yes" \
  --data-binary "@${XLSX_FILE}" \
  "${AIOPS_BASE_URL}/xlsx-import/execute?owner=acme&repo=widget"
```

UI では dry-run 後に同じファイルを使い、明示確認後だけ execute へ転送する。CLI で Dry-run 後にファイルを変更した場合は署名を再計算する。確認ヘッダが無い場合は `409`、`owner` または `repo` が無い場合は `400`、allowlist 外は `403`。

実行結果は `result.imported`、`result.skipped`、`result.failed`、人間可読の `result.summary` と行ごとの `progress` を返す。既に `import_ledger` にある `source_key` は `reason: "already imported"` 付きの `skipped` になり、サマリにも理由が表示される。

認証とテンプレート検証に成功した dry-run、および確認・allowlist・フェイルセーフの実行前ゲートを通過した execute だけが、ファイル本体やファイル名ではなく SHA-256 と操作種別を追記専用監査ログへ記録する。提出ファイルに個人情報を含める場合も監査ログへ内容は複製されない。

## 5. 再実行

同じ `source_key` の行は import ledger によりスキップされる。Issue body の import marker は人が GitHub 画面で由来を確認するための目印で、重複判定の正本は `import_ledger`。
