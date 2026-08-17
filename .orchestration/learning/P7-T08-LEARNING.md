# P7-T08 Learning

## Reusable Findings

1. A generic permission ledger can safely serve multiple authorities when new targets have an explicit namespace and every legacy consumer excludes that namespace before parsing.
2. Default-none capability enforcement belongs in the same SQL statement that acquires the read model. A separate grant lookup introduces a revoke race and makes accidental post-fetch masking easier.
3. Resource-grant breadth must shape nested projections: repository access should not implicitly expose project-level workflow/action references when there is no repository-to-run/action authority link.
4. Dynamic grants cannot live statically in an OPA bundle. Resolve the active grant in the authoritative data query, pass its exact canonical resource context to OPA, and require both layers to allow.
5. Uniform 404 must cover OPA deny/failure as well as SQL scope misses; otherwise a policy response becomes a workspace existence oracle.
6. A global recipient scope is not a grant. Preserve global assignment semantics while still requiring an explicit resource grant.
7. Fail-closed dependencies still need production composition. A route that always denies because its policy client is never constructed is unavailable, not shipped; add a composition-level success test alongside deny-path tests.

## Apply To

- P7-T10 Workbench UI, Workbench list endpoints, future gadget/resource panels, and live OPA composition.
- Any future `grants` consumer must distinguish its target namespace before interpreting target syntax or invoking an external revoker.

No new skill or rule was promoted by this worker.
