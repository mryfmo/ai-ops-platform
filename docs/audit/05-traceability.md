# 05. 仕様トレーサビリティ品質 監査レポート

- 監査日: 2026-07-11 / 監査対象コミット: `39b95944e9f17dffce500c21f40989f6fa86092d`
- 監査観点: 「仕様 ID ⇔ 実装 ⇔ テストの相互参照」という本プロジェクトの中核規律が、どこまで実質を持つか。

## 1. 対象範囲と監査観点

packages/traceability（verifyTraceability.ts、spec-ids/\*.json）、docs/spec/spec-id-catalog.md、CI ゲートとしての実効性。

## 2. あるべき姿

トレーサビリティの価値は「仕様変更時に影響箇所を特定できる」「実装が仕様を満たすと主張できる」こと。そのためには (a) 全 ID の正本定義が参照可能、(b) 実装参照とテスト参照の両方が強制、(c) 参照の実質（コメントでなく検証コードが ID を担保）が抜き取り確認される、の 3 点が最低線。

## 3. 指摘事項サマリ

| ID          | タイトル                                          | Severity | 工数 |
| ----------- | ------------------------------------------------- | -------- | ---- |
| AUD-TRC-001 | 旧仕様 ID の正本定義がリポジトリ外にあり参照不能  | High     | M    |
| AUD-TRC-002 | 検証が substring 出現のみで意味的整合を担保しない | High     | M    |
| AUD-TRC-003 | テスト側参照が計測されるだけでゲートされない      | Medium   | S    |
| AUD-TRC-004 | AC / SPEC-EXT がゲート対象外                      | Medium   | S    |
| AUD-TRC-005 | traceability_matrix 等の生成物が陳腐化            | Low      | S    |

## 4. 個別指摘

### AUD-TRC-001: 旧仕様 ID の正本定義がリポジトリ外にあり参照不能

| Severity | 工数 | 関連仕様                           | 関連指摘    |
| -------- | ---- | ---------------------------------- | ----------- |
| High     | M    | トレーサビリティ規律そのものの前提 | AUD-VER-006 |

**現状**: REQ-001..035・TH-001..007・旧 AC・多くの SPEC-INT は、リポジトリ内では `spec-ids/{prjops,devops}.json` に**文字列として列挙されるだけ**で定義文がない。正本は authoring 時のアップロード文書（リポジトリ外、DOC-00..07 等）にあり、現環境から参照できない。実例: 本監査で違反を指摘した SPEC-INT-080 の定義文は `docs/spec/spec-id-catalog.md` に存在せず、graphClient.ts のコメント引用（「初期 30 秒、最大 15 分」）が事実上の正本になっている。
**根拠**: `packages/traceability/spec-ids/devops.json:84`、`docs/spec/spec-id-catalog.md`（SPEC-INT-080 なし、grep 確認済み）、`packages/shared/src/clients/graphClient.ts:13`
**あるべき姿**: 全 ID の定義文がリポジトリ内（spec-id-catalog.md）で読める。コード中のコメント引用が唯一の定義であってはならない（引用が改変されても検出できない）。
**ギャップ**: 実装が仕様に合っているかを、当のリポジトリだけでは原理的に検証できない。新規 ID（REQ-036+ 等）はカタログ化されており、二重基準になっている。
**推奨対応**: 原本文書から旧 ID の定義文を spec-id-catalog.md に移植（一回きりの写経作業）。以後は「カタログにない ID は traceability が fail する」ゲートを追加。

### AUD-TRC-002: 検証が substring 出現のみで意味的整合を担保しない

| Severity | 工数 | 関連仕様                                                   | 関連指摘    |
| -------- | ---- | ---------------------------------------------------------- | ----------- |
| High     | M    | mise run traceability（Definition of Done の一部）の実効性 | AUD-REL-003 |

**現状**: verifyTraceability.ts は src/test コーパスへの `.includes(id)` 一致のみ（91-92 行、確認済み）。コメントに ID が書いてあれば「実装済み」扱いになる。実例が既に存在する: SPEC-INT-080 は graphClient.ts のコメントに出現するためゲートを通過するが、GitHub 側の実装は存在しない（AUD-REL-003）。**仕様違反とゲート通過が両立している**。
**根拠**: `packages/traceability/src/verifyTraceability.ts:91-92,222`
**あるべき姿**: 構文チェックである旨は自認されており、それ自体は誠実。ただし Definition of Done の一角を占める以上、「ID 出現 = 実装済みではない」ことを利用者（特に AI エージェント）に誤解させない設計が要る。
**推奨対応**: 最小是正 = 出力とドキュメントに「本ゲートは参照存在チェックであり実装保証ではない」を明記し、PR テンプレートのチェック項目を「ID を記載した」から「ID の要求内容を満たすことをテストで示した」に変更。恒久策 = describe/it タイトルの ID 抽出（テスト名 ⇔ ID の対応表生成）で「その ID を検証するテストが 1 件以上ある」ことを機械化。

### AUD-TRC-003: テスト側参照が計測されるだけでゲートされない

| Severity | 工数 | 関連仕様                                    | 関連指摘    |
| -------- | ---- | ------------------------------------------- | ----------- |
| Medium   | S    | テスト規約（describe/it に仕様 ID）との整合 | AUD-VER-001 |

**現状**: `missingFromTest` は算出・出力されるが exit code に影響しない（222 行: fail 条件は REQ/SPEC-INT/TH の missingFromSrc のみ）。実装にだけ ID を書きテストゼロでも CI green。
**根拠**: `packages/traceability/src/verifyTraceability.ts:96,222-232`
**推奨対応**: まず現状の missingFromTest を棚卸しし（ゼロでないはず）、埋めた上でゲート化。段階導入として新規 ID のみ必須にする手もある。

### AUD-TRC-004: AC / SPEC-EXT がゲート対象外

| Severity | 工数 | 関連仕様 | 関連指摘    |
| -------- | ---- | -------- | ----------- |
| Medium   | S    | —        | AUD-VER-004 |

**現状**: 受入基準（AC、計 82 件）と外部仕様（SPEC-EXT、計 52 件）は報告のみで fail しない。受入基準こそ「done の定義」なのにトレースが任意になっている。
**根拠**: `packages/traceability/src/verifyTraceability.ts:222`（["REQ","SPEC-INT","TH"] のみ）
**推奨対応**: AC をゲート対象に追加（SPEC-EXT は外部システム仕様のため warn 維持で妥当）。

### AUD-TRC-005: traceability_matrix 等の生成物が陳腐化

| Severity | 工数 | 関連仕様 | 関連指摘    |
| -------- | ---- | -------- | ----------- |
| Low      | S    | —        | AUD-VER-006 |

**現状**: `output/traceability_matrix.md` と VERIFICATION_REPORT 内の件数が現行 spec-ids JSON（PrjOps: REQ34/SPEC-EXT27/SPEC-INT30/AC38、DevOps: REQ25/SPEC-EXT25/SPEC-INT30/TH7/AC44）と一致しない。
**推奨対応**: matrix を CI アーティファクト化し、コミット済みスナップショットには生成日時とコミットハッシュを埋める。

## 5. 良好事項

- 根拠 ID ヘッダの強制（basisHeaderFailures: shared/reporting と server/src の先頭 500 字に ID 必須）と ADR 参照実在チェック（adrReferenceFailures）は substring 照合より一段強い実質を持つ。
- 仕様 ID の名前空間（system + ID）で PrjOps/DevOps の番号衝突を扱う設計は妥当で、spec-ids JSON の構造も検証可能な形になっている。
- 新規 ID（REQ-036 以降等）は spec-id-catalog.md に定義・ADR・代表実装/テストまで揃った表があり、旧 ID もこの形式に揃えれば AUD-TRC-001 は解消する。
