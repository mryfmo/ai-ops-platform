<!-- 根拠: PRD-010 / GOV-001 / P0-T01 -->

# P0-T01 baseline revalidation

検証日時: 2026-08-10（JST）

## 結論

パック基準 `49e2e3c0a3a9d30be46b2a3ae0727009d9eec324` から
`ff66698e7271cb5f271ce895740db3ae6828c01e` までの差分は、Owner 承認済みの
[baseline delta](../../../.orchestration/plan/2026-08-10-pack-adversarial-review/02-baseline-delta.md)
を正本とする。本書は、それ以降の main 取込 1 件（PR #152）を追補分類し、現在の
HEAD・tree・依存・CI を再検証する。

- HEAD: `1f8e12c97cca8604cabaa9f35d5bcb0bfda2c91c`
- tree: `59cb4af42ef4d99be5289304fcfefe43cfbaef58`
- commit: `plan: final-architecture パック取込（承認済み baseline-delta 適用） (#152)`
- commit date: `2026-08-10T08:21:46+09:00`
- 判定: PR #152 に runtime、DB、workflow、依存関係の変更はなく、既存実装またはパックの
  architecture invariants と衝突する差分はない。

## PR #152 の追補分類

比較範囲は `ff66698..1f8e12c`。113 files、9,315 insertions、1 deletion だった。

| 分類 | files | 判定 |
|---|---:|---|
| `docs/**` | 109 | 最終構成パック、ADR-0020..0028、検証資料の取込。runtime には非結線 |
| `.orchestration/plan/**` | 2 | 承認済み adversarial review と baseline delta の記録 |
| `.prettierignore` | 1 | pack 原本の byte 忠実性を保つ formatter 対象外指定 |
| `packages/traceability/output/**` | 1 | 既存仕様カタログから再生成した matrix の時刻差分 |
| 実装・テスト・DB・workflow・deploy・dependency manifest | 0 | 変更なし |

`packages/**/src/**`、`packages/**/tests/**`、`.github/**`、`verification/**`、
`deploy/**`、`contracts/**`、`ops/**`、`runbooks/**` に差分はない。したがって、決定的
lib、追記専用 audit、三層 sanitize、取得側 permission filter、injectable client、
one-writer/PR-only、Cloudflare Artifacts 不採用の各 invariant に runtime 上の変更はない。
ADR-0020..0028 は Proposed の設計記録であり、本取込だけで production path を変更しない。

## リポジトリ状態

証跡取得開始時、`git diff --exit-code HEAD --` と
`git status --porcelain --untracked-files=no` は空で、tracked content は clean だった。
`git status --short` にはタスク開始前から存在する次の untracked 2 件が表示されたため、
それらは変更・削除・成果物への追加をしていない。

- `.pnpm-store/`
- `references/ai-ops-platform-final-implementation-pack_2026-08-09.zip`

## 依存関係と toolchain snapshot

`ff66698..1f8e12c` で `pnpm-lock.yaml`、`.mise.toml`、root/workspace の
`package.json` に差分はない。

| 対象 | snapshot |
|---|---|
| `pnpm-lock.yaml` SHA-256 | `5bf16d460aadab866f670890ea54ef39e203dd40852b5ff04e7cbb1af63f896d` |
| `.mise.toml` SHA-256 | `59cc747741443ff9c575f0a0f6ea49162f2f1946948e7274062fb2d15a63bcfb` |
| root `package.json` SHA-256 | `cf11d684bb12172c16456102d50b87b832b1105a82d7004ac13ff0af18d169b9` |
| mise Node | `22.23.1`（manifest: `22`） |
| mise pnpm | `11.13.0` |
| mise actionlint | `1.7.12` |
| PostgreSQL | GitHub Actions `postgres:16`; local disposable verification `16.14` |

## CI / test evidence

main HEAD の [CI run 31341703185](https://github.com/mryfmo/ai-ops-platform/actions/runs/31341703185)
は `build-test` と `gitleaks` が success。run は
`2026-08-09T23:21:49Z`〜`23:26:23Z`（4分34秒）で、PostgreSQL 16 service 上で
DB を作成して検証した。

- coverage: 182 test files、2,270 passed、4 skipped（2,274 total）
- governance Node tests: 20 passed
- build、typecheck、lint、format、audit、traceability: success
- `P001 PostgreSQL integration passed`
- gitleaks: success

ローカルでも PostgreSQL 16.14 の隔離 cluster と 3 DB（`aiops_test`、
`aiops_load_test`、`aiops_p001`）を用い、次を独立に再実行した。

- `mise run ci`: pass（69.61秒、182 files、2,274 passed、0 skipped）
- `mise run typecheck`: pass（4.84秒）
- `mise run test:coverage`: 182 files、2,270 passed、4 skipped、pass（20.85秒）
- `mise run verify:db`: `P001 PostgreSQL integration passed`（2.60秒）

未変更のローカル command は Codex runner の port-bind 制限により Turbopack が
`Operation not permitted` で停止したため、この試行は green と扱わなかった。最終実行は
repo 外の一時 `NODE_OPTIONS` shim で Next の公式 `--webpack` option だけを付与し、clean に
作り直した上記 3 DB に対して `mise run ci` の全 task を exit 0 まで完走した。shim は repo
差分・依存・設定に含まれない。通常 Turbopack は main CI と PR #153 CI が同じ HEAD/content
で green のため、bundler 固有経路も別途成立している。

## GOV-001

HEAD/tree、承認済み `49e2e3c→ff66698` delta、PR #152 の全差分分類、依存 snapshot、
実 PostgreSQL を含む `mise run ci` 証跡が揃った。P0-T01 PR の Reviewer/Owner approval を
もって、この追補を GOV-001 の現行 baseline として確定する。
