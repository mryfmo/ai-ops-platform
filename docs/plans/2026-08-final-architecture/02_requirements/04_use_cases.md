# 主要ユースケース

## UC-001 Teamsからプロジェクト状況を確認

1. 利用者がTeamsでprojectを指定して質問。
2. OpenTag-derived adapterがidentity/project contextをControl APIへ渡す。
3. OPAが参照範囲を判定。
4. Plane/GitHub/Confluence/Work IQから必要情報を取得。
5. LiteLLM経由Claudeが、決定的に算出済みの数値を変えずに要約。
6. source/version付きcardをTeamsへ返す。

## UC-002 会議からactionを発行

1. Graphが会議終了を通知。
2. TemporalがWispr note取得をretry付きで開始。
3. Claudeがdecision/action/risk/question候補を構造化。
4. Teamsで人間がowner/due/targetを修正・承認。
5. Plane/GitHub/Confluence/SharePointへ責務別に発行。
6. すべてのIDとversionをledgerへ記録。

## UC-003 AIコーディングタスク

1. Teams/Web/Planeからtask作成。
2. task manifestとWriterを決定。
3. 人間が実行を承認。
4. TemporalがGitHub Actions/Ephemeral Runnerを起動。
5. Claude CodeまたはDroidがallowed path内だけ編集。
6. branch/PRを作成しCIを実行。
7. 別モデルがreview reportを作成。
8. 人間がmerge。production deployはEnvironment承認。

## UC-004 Incident response

1. Monitor/OTel alertを受信。
2. Temporal IncidentWorkflowがdeployment、PR、logs/tracesを収集。
3. ClaudeがRCA候補を作成。
4. Writerがrepair PRを作成。
5. CI/security/human review。
6. 人間承認後にdeployし、SLO回復を確認。
7. Confluence RunbookとSharePoint postmortem、Plane再発防止taskを発行。

## UC-005 M365機密質問

1. User delegated tokenでWork IQに問い合わせ。
2. Work IQがM365 permissionをtrim。
3. OPAがclassification/purpose/provider routeを判定。
4. RestrictedならWork IQ内のaskで完結。
5. 外部LLM許可時だけ最小化した事実をLiteLLMへ送る。
6. source refsとpolicy decisionを返す。
