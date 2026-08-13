# P3-T02 learning

## L-P3T02-01: workflow sandbox 内コードは V8 coverage に計上されない
replay/probe など webpack bundle 内で実行される workflow code は vitest の V8 coverage
から見えない。対処: 検証可能な境界（validation パス）は直接テスト、sandbox 専用
ファイルは理由コメント付きで coverage 除外し、行使は replay test で担保する。

## L-P3T02-02: historyToJSON は fetchHistory の結果に使えない場合がある
@temporalio/common の historyToJSON が payload metadata（json/plain）の変換で
toProto3JSON エラーになる。protobufjs の `history.toJSON()` +
`History.fromObject(JSON.parse(...))` の対で永続化すれば SDK 間の相互運用に十分。

## L-P3T02-03: cwd reset とパッケージ内相対操作の混在は誤編集を生む
tool 呼び出し間の cwd reset を跨いだ `git checkout -- package.json` が
別 package.json を巻き戻し、依存が消えた。恒久則: git の復元操作は常に
repo-root 相対の明示 path（`git checkout -- packages/x/package.json`）で行う。
