# P005-T11 Acceptance

Status: accepted

- Added a networkless injectable Graph sandbox smoke core, `graph:smoke` script, and 39 focused tests.
- The requested external high session could not start because of its usage limit, so an equally capable peer Codex worker executed the bounded task under root orchestration without an unverifiable model claim.
- Initial independent review rejected four new root causes: callable opt-in bypass, truthy-ID cleanup loss, uncorrelated DB counts, and unsafe evidence destinations.
- The peer revision removed the opt-in override, checks the exact process environment before any operation, owns cleanup after every resolved create result, requires explicit subscription/message/five-client-request DB correlation with a positive count, and publishes only a new file under an exact real nonsymlink evidence root using no-overwrite hard-link semantics.
- Independent final re-review `/root/p005_t11_review` accepted all four corrections and confirmed no prior root recurs.
- Final focused tests passed 39/39; final orchestrator `mise run ci` passed with 1,147 workspace tests.
- Real tenant execution remains blocked and is not represented as completed evidence.
