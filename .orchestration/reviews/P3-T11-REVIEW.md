# P3-T11-REVIEW — durable execution chaos suite（writer=codex）

```yaml
task_id: P3-T11-REVIEW
reviewer: claude-deep-dot
head_sha: 240042395efc3d8fbdbda38ac78ba73a79dfbf47
verdict: approve
```

## 検分（独立実行）

- **evidence**: 14 workflows × 56 scenarios。recovered 43 / explicit failures 13 /
  **duplicateSideEffects 0 / runningWedges 0 / silentSuccesses 0** — WBS acceptance
  を機械値で充足。Vitest gate が evidence の byte 等価再生成と 0 値を強制
- **finding 運用**: P3-T11-001（replayProbe の unresolved RUNNING wedge）を
  worker が契約どおり fix せず報告 → orchestrator 裁定 fix（2e4cca3、
  E-CP-EXTERNAL-UNRESOLVED terminal 化）→ worker が probe 期待値を
  「terminal + failure type = E-CP-EXTERNAL-UNRESOLVED」へ更新し evidence 再生成。
  境界（control-plane src は worker 禁止）が正しく機能した初例
- **境界**: src 差分は orchestrator fix の replayProbe 1 file のみ。merged
  fixtures 差分 0。PR #226 は app/aiops-pr-bot author・non-draft
- **独立再現**: 25 files / 222 tests green（chaos suite 含む）、fresh 使い捨て DB で
  素の `mise run ci` exit 0
- **手法**: cache-0 restart 一般化 / live start-to-close + heartbeat fault 注入
  （heartbeat は 5 attempts 後 explicit fail）/ duplicate flood の台帳検証 /
  approval flood — P3-T03..T10 の恒久則（一意 ID・明示 time advance・正本意味論
  mock・明示 timeout）に準拠

## 判定

findings 0。f189f1e の clean-runner fail は chaos と無関係の隣接 flake
（plan-only bundle テストの 5s timeout — P3-T09-R01 同族）で、orchestrator 随伴
fix（明示 120s timeout、2400423）後に clean-runner build-test + gitleaks green。accept。
