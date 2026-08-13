# セッション継続ハンドオフ — P2 8/10 完了・Owner 待ち 3 点・P3 開始（2026-08-13）

前版: `2026-08-12-p2-t02-close.md`。正本 WBS:
`docs/plans/2026-08-final-architecture/06_implementation/02_wbs.yaml`。

## 1. P2 状況（tenant 不要タスクは全完了）

| タスク | PR / 状態 |
| --- | --- |
| T01 alias manifest | #182 merged |
| T02 service config（OSS-only oss.3 + route boundary） | #185/#186 merged |
| T05 shared gateway transport + error normalization | #188 merged |
| T06 server consumer 移行（direct/agent-sdk fail-closed） | #189 merged |
| T07 Web AI SDK 移行 | #191 merged |
| T08 coding-agent 資格移行 | #193 merged |
| T09 synthetic dual-path conformance | #195 merged |
| **T03/T04** | **blocked: test tenant（Owner 準備）** |
| **T10 cutover** | **blocked**: acceptance が network-level egress 遮断
（deploy/aws 実 infra = P10-T01 / ENV gate）+ 実 E2E（tenant）に依存。
WBS 依存（T09 のみ）より実体依存が広い — tenant + AWS env 到着後に着手 |

- 証跡 sync: #187/#190/#192/#194 merged + T09 分は 2026-08-13 sync PR
- レビュー方式の実績: worker 実装タスク（T07/T08/T09）は orchestrator（claude）が
  全 diff 読了 + suite/smoke 独立再実行で adversarial レビュー。全 findings resolved

## 2. Owner 待ち 3 点（P2 完結条件）

1. **GitHub Actions 資格**: var `LITELLM_BASE_URL` + secret `LITELLM_CODING_VIRTUAL_KEY`
   （claude-code alias 限定・budget・expiry）→ coding-task workflow 実 dry run 1 周
2. **test tenant**: AWS（Bedrock 有効化、ap-northeast-1、STS で assume できる入口）+
   Anthropic 実験 workspace API key → T03/T04 起票可能
3. tenant + AWS env 後: T10 cutover（writer=claude、risk critical）

## 3. P3 開始（entry 充足: Temporal profile 決定は P0-T05 済）

- 次タスク **P3-T01** Provision Temporal namespace and worker connectivity
  （writer=claude / reviewer=codex。allowed: deploy/temporal/** deploy/aws/**
  packages/control-plane/**。deps P1-T01/P0-T07 済）
- P3 exit 系: workflow history/replay・approval signals・scheduler shadow 一致・
  crash recovery。STOP: nondeterministic workflow / double side effect / replay failure

## 4. 環境メモ（増分）

- worker への PR 指示に「draft にしない」を含める（#195 は draft で作られ Owner が
  merge できなかった — ready 化で解消）
- 同一 worktree 共有の罠（タスクファイルと orchestrator のブランチ切替）は
  memory agmsg-regime-topology 参照
