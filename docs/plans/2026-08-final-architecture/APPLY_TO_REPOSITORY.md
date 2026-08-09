# Apply This Pack to `mryfmo/ai-ops-platform`

このパックは実装コードを直接変更したものではない。まず計画・契約・ADRとしてrepoへ導入し、P0 gateを完了してから機能実装を開始する。

## 1. Checkout and baseline

```bash
git clone https://github.com/mryfmo/ai-ops-platform.git
cd ai-ops-platform
git fetch origin
BASE=49e2e3c0a3a9d30be46b2a3ae0727009d9eec324
git show --no-patch --format=fuller "$BASE"
git status --short
```

HEADがBASEと異なる場合は`BASELINE.md`のdelta手順を実施し、先に`baseline-delta.md`をOwner承認する。

## 2. Import documentation without overwriting source specs

推奨配置:

```text
docs/plans/2026-08-final-architecture/
```

`docs/PrjOps.zip`、`docs/DevOps.zip`、既存ADR/specを上書きしない。ADR-0020〜0028は最初は`Proposed`として`docs/adr/`へ移し、既存ADRとのsupersessionと新spec IDをreviewする。

## 3. First PR

Branch:

```bash
git switch -c plan/P0-final-architecture
```

First PRは文書、traceability seed、fitness test skeletonだけに限定する。Temporal/LiteLLM等のproduction codeを同時に入れない。

必須review:

- product/architecture owner
- security/M365 owner
- operations owner
- repository CODEOWNER

## 4. Execute P0 in order

1. P0-T01 baseline/CI再検証
2. P0-T02 branch protection有効化とnegative probe
3. P0-T03 ADR/spec/AC追加
4. P0-T04 architecture fitness gates
5. P0-T05 performance baseline
6. P0-T06 license/terms review
7. P0-T07〜T09 ENV/identity/flags decisions
8. P0-T10 signed gate

P0-T02が完了するまでAI coding runnerをproduction repositoryで有効にしない。

## 5. Launch model tasks

各taskについて`TASK_MANIFEST_TEMPLATE.yaml`をWBSから生成し、`EXECUTION_PROMPT_TEMPLATE.md`を使ってWriterへ渡す。Writer完了後、別モデルへ`REVIEW_PROMPT_TEMPLATE.md`を渡す。

## 6. Verify pack and imported copy

```bash
python docs/plans/2026-08-final-architecture/scripts/validate_pack.py
mise run ci
```

実行できなかった外部E2Eは完了扱いにしない。
