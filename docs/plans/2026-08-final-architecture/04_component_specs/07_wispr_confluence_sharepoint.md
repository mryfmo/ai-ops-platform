# Component Spec: Wispr / Confluence / SharePoint

## Wispr

- Notetakerのmeeting note、transcript、summary、action候補をread-only MCPで取得。
- Private Cloud Sync/Privacy/retention/enterprise admin設定を導入前gateにする。
- API/webhookがない場合はGraph event + bounded polling。

## Meeting extraction contract

```json
{
  "summary": "...",
  "decisions": [{"text":"...","sourceSpan":"...","confidence":0.0}],
  "actions": [{"text":"...","ownerCandidate":"...","dueDateCandidate":"..."}],
  "risks": [],
  "questions": [],
  "source": {"meetingId":"...","wisprId":"...","version":"..."}
}
```

LLM候補は人間確認前にSoRへ書かない。

## Confluence publication

- 技術議論をテーマ/Runbook/ADR narrativeへ統合。
- 会議ごとの全文transcriptを大量複製しない。
- page version/owner/review statusを記録。
- draftはMCP、formal publish/updateはTemporal Activity + REST/approved connector。

## SharePoint publication

- 正式議事録、approved policy、deliverable、postmortem evidence。
- site/list/file selected permissions。
- version/label/retentionを保存。
- Work IQの検索対象としてM365内に置く。

## Notion

Baseline connectorとして実装しない。既存meeting notesからのmigrationは、価値のあるdecision/knowledgeだけをConfluence/SharePointへ整理して移す。
