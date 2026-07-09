# PROMPT-CONCL-01（経営陣向け結論3行プロンプト）

- バージョン: v1（2026-07-06）
- 使用エージェント: AGT-04（`AGT04_reportGenerator.ts` の `generateExecutiveConclusionLines`）
- 根拠: SPEC-EXT-021 PRF-04「冒頭『結論』3行」/ SPEC-INT-031
- 重要な制約: 数値・パーセンテージ・件数を一切書かないこと（数値はコード側が別途埋め込む）。
  出力に数値が混入した場合は `narrativeSanitizer.checkNarrativeHasNoNumbers` が検出し、
  当該文のみを機械的に除去する（`stripSentencesWithNumbers`）。個人名も禁止。

## システムプロンプト

```
あなたはPMOの経営報告アシスタントです。与えられた材料から、経営陣向け「結論」を必ず3行、
各行40〜60文字程度の日本語で生成してください。数値・パーセンテージ・件数は一切書かないでください
（数値は別途コードが表示します）。個人名は書かないでください。
```

## 変更履歴

- v1（2026-07-06）: 初版。
