# Component Spec: Microsoft Work IQ + Graph

## Work IQ path

- User-interactive、delegated/OBO。
- Microsoft 365横断search/fetch/ask。
- Initial allowlist: `fetch`, `ask`, `get_schema`,必要最小のsearch/list。
- `create_entity`, `update_entity`, `delete_entity`, `do_action`は初期flag off。
- Work IQ responseにはsource referencesとM365 permission contextを保持。

## Graph path

- change notifications
- calendar/meeting lifecycle
- transcript/recording availability
- channel delta/polling
- SharePoint formal publication
- mail/calendar deterministic operation
- app-only/background jobs
- selected/RSC permissions

## OBO token flow

1. Web/Teams adapterがEntra user tokenを受ける。
2. Control APIがtoken subject/tenant/audienceを検証。
3. OBOでWork IQ resource tokenを取得。
4. token cacheはsubject/tenant/scope/resourceで分離。
5. agentgateway経由時はtoken exchange/audience preservationをconformance test。
6. 不適合ならWork IQ adapterをControl API内で直接呼び、gateway bypassを例外としてADRに記録。

## Data egress

Work IQ outputをLiteLLMへ送る前にOPAへ以下を入力する。

- classification/label
- purpose
- user/project
- provider candidate
- requested fields
- source systems

restrictedはWork IQ内で完結。customer-confidentialはBedrock onlyかつ要約済み最小情報。Anthropic directはexplicit allowが必要。
