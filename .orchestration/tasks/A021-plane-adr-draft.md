# A021: ADR-0019 草案(Plane self-host 統合)+ plans/014 草案を作成する

- task_id: A021
- repo: /Users/mryfmo/Workspace/ai-ops-platform(worktree /private/tmp/ai-ops-platform-A001)
- 発行: orchestrator-fable5 (2026-07-19)
- 担当: codex-gpt56sol-high
- max_turns: 40
- 実行順: A019 完了後。
- 根拠: 操作者指示(2026-07-19)「Plane self-host を統合。既存を引きずらず PrjOps+DevOps のあるべき姿から検討」。
  orchestrator の調査結論(本ファイル末尾の設計骨子)を草案の出発点とするが、ワーカー自身の検証で
  補強・反証してよい(反証があれば草案に正直に書く)。

## 成果物

1. `docs/adr/0019-plane-workflow-backend.md`(ステータス「提案」、new-adr の 5 節構成、
   仕様ID アンカーは既存 ADR-0018 の流儀に従い PrjOps/DevOps 両系に付与)
2. `plans/014-plane-integration.md`(Phase A〜D、各 task に Allowed files / Complete / Verify /
   STOP、既存 plan の書式に準拠)
3. plans/README.md への 014 行追加(Status: TODO、Depends on: 0019 承認)

## 設計骨子(orchestrator 調査結論 — 草案の正本。2026-07-19 操作者指摘で改訂)

- **三層モデル(操作者指摘「コンテンツ管理は GitHub」を第一原則とする)**:
  1. コンテンツ/レコード正本 = **GitHub**(DEC-SPEC-001 の prjops-data: PJ-*/ORG-*/ST-*/ISSUE-*/ACT-*/SU-*、
     questionnaires、投資家データ + 本体 repo の docs/報告書/議事録)。git 版管理・PR レビュー・
     署名スナップショット・不変 SHA 固定は現行どおり不変。
  2. ワークフロー運用状態 = Plane CE(self-host)。**正本ではなく git レコードの投影(operating view)**。
     work item は external_id/external_source で正準 ID(ISSUE-*/ACT-* 等)を刻んだミラー。
     Kanban 位置・cycle・担当・進行ステータスの人間操作面。
  3. 頭脳 = プラットフォーム(認可・監査・決定的数値・報告)。
- **統治重量によるデータ分類(2026-07-19 操作者レビューで確定した境界規則)**:
  「レコード級の事実は git、高頻度の運用流動は Plane、プラットフォームは全てを観測・監査し、
  流動をレコードへ昇格させる」
  1. **git 正本(低頻度・高重要度)**: PJ-*/ORG-*/ST-* レジストリ、questionnaires、投資家データ、
     報告・監査が引用する正式 issue/action 台帳エントリ。変更は PR レビュー/typed proposal 経由のみ。
  2. **Plane 権威(高頻度・低重要度、git 往復なし)**: カンバン位置、担当、cycle 帰属、item 上の議論、
     日々のタスク。現行設計が GHP v2 を workflow 正本とした分離と同型 — 弱い脚の差し替えであり
     新しい統治変更ではない。
  3. **プラットフォーム**: webhook→pm_events 追記(全運用流動の観測履歴)、snapshot reconcile、
     認可・監査・決定的数値・報告は不変。
  4. **昇格パイプライン(3 方の接合点)**: 運用上の事実がレコードになるべき瞬間(正式クローズ、
     週次 status update 等)のみ、AGT-02/03 の構造化 + Plan 012 typed proposal + 承認 →
     prjops-data への PR/commit。競合は git-wins + 再投影。
- **人間×エージェント共用作業台としての Plane(本プロジェクト趣旨の実装面)**: AGT-02 が intake から
  work item 自動起票、AGT-03 が分析コメント添付、AGT-06 が期限リマインドを item 上で実施。
  「人間は判断・承認のみ、エージェントが実行」を人間側の道具の中で可視化する。
- DEC-SPEC-001 は再考不要(正本不動)。DEC-SPEC-008 改訂は board/workflow 実装手段
  (GHP v2 → Plane)の置換のみ。ADR には「Plane 全往復案(運用性が死ぬ)」と「Plane 全正本案
  (統治が死ぬ)」を棄却代替案として明記し、この分類が 3 方(Plane の運用体験 / GitHub の統治 /
  本プロジェクトの監査・認可・自動化)を各々最大限採る根拠を書く。
- DEC-SPEC-008 の再考条件成立の証拠を ADR に列挙: E-VIEW02 未実装、ProjectV2 CAS 不在で書込み恒久禁止、
  T11〜T14 未完、PM reconcile デフォルト無効。
- 識別: PJ-* が唯一のユーザー向け認可キーのまま。Plane project UUID は署名付きマッピング属性
  (A020 fixture と同形式、写像先を plane_project_id に)。Plane 側 work item には
  external_id/external_source で PJ-* を刻む。
- 統合面: packages/shared に planeClient(FetchLike + PlaneTokenProvider 注入、fetchWithBackoff、
  60req/min 前提のバッチ設計)。packages/server に webhook route(HMAC X-Plane-Signature の
  constant-time 検証、X-Plane-Delivery で dedupe、events queue へ)。
- Phase A(sandbox 構築)に **STOP 条件: #5757(API キーの workspace 越え読取)が現版で再現したら停止**。
  AGPL 境界: API 連携のみ、vendor/リンク禁止、Plane 改変時は公開 fork 義務、を ADR に明記。
- Phase C の board 開通は DEC-SPEC-008 改訂 decision PR(脅威/データ影響レビュー + Plan 010 同一
  コミット更新 + 人間承認)を前提ゲートに。Phase D の書込みは Plan 012 の typed proposal/approval
  境界のみ(直接書込み・自動書込みは恒久禁止)。
- 棄却代替案も ADR に記録: GHP v2 継続(T11-T14 完遂)、自前 Kanban DB(dual-truth で棄却済み)、
  Plane Commercial(closed-source 依存)、Plane を全データ正本化(CE の統治機能不足で棄却)。

## 制約

- ADR/plan とも「提案」止まり。採用化・decision PR・DEC-SPEC-008 本文の変更は行わない(owner gate)。
- docs/audit・worklog 編集禁止。依存追加禁止(文書のみ)。
- format / ci / traceability green、crit CLI 自己レビュー、PR(base=main、ai-generated、draft)、
  checks green → RESULT。merge は owner 承認後。

## 完了報告

```
AGMSG-RESULT v1 task_id=A021 status=ready_for_review|blocked report=.orchestration/reports/A021-report.md validation=.orchestration/validation/A021-validation.md sandbox=.orchestration/sandboxes/A021-sandbox.md learning=.orchestration/learning/A021-learning.md autoskill=.orchestration/autoskill/runs/A021-autoskill.md
```
