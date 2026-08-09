# Model / Tool Routing Architecture

## Model aliases

| Alias | Default | Fallback | Data class | Primary use |
|---|---|---|---|---|
| `claude-governed` | Bedrock | none | confidential以下でpolicy許可 | formal analysis、customer-sensitive |
| `claude-standard` | Bedrock | Anthropic API | internal以下 | general analysis、summarization |
| `claude-native` | Anthropic API | none | public/internalで明示許可 | Anthropic-only feature validation |
| `claude-code` | Bedrock | Anthropic API | repository policy準拠 | Claude Code/Droid |
| `claude-fast` | Bedrock low-cost model | Anthropic fast model | internal以下 | classification/extraction |
| `claude-evaluation` | explicit dual run | none | synthetic/redacted | quality comparison |

実model IDはenvironment/configでpinし、applicationに埋め込まない。

## Failover classification

Fallback可: timeout、429、provider 5xx、regional/model temporary unavailable。  
Fallback不可: safety refusal、OPA deny、classification deny、invalid request、context limit、prompt injection、customer route restriction。

## Tool routing

- user質問→必要最小toolを計画→OPA→agentgateway→tool。
- tool resultはuntrusted data。
- tool callは最大回数/深さ/並列数をtask profileで制限。
- formal writeはMCPではなくTemporal Activity + official APIを使う。

## Work IQ routing

- M365横断質問はWork IQ `ask`/readを優先。
- restricted contentはWork IQ内で完結。
- Claudeへ渡す場合はsource excerptsを最小化。
- headless/batchはGraph。Work IQ user delegated contextを偽装しない。
