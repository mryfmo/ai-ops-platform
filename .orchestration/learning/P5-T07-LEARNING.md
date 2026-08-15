# P5-T07 Learning

## Reusable Findings

1. A critical egress invariant needs two independent stops: policy denies restricted data, and the dispatch boundary rejects restricted even if policy is misconfigured or compromised.
2. Incomplete Work IQ provenance must raise classification before policy input; Rego should independently reject incomplete provenance paired with a lower classification so caller drift cannot relax the route.
3. Redaction/minimization obligations are safer when enforced by deterministic field selection and deletion, not represented as a promise that another component applied them.
4. A policy-provided byte limit still needs a platform absolute ceiling; otherwise a drifted allow decision can make the nominal bound meaningless.
5. A policy bundle semver bump must move the Rego default, client expectation, deployment bundle revision, and smoke expectation together.

## Apply To

- Later P5 Work IQ egress/source-reference tasks, generic tool-result-to-LLM boundaries, and policy bundle release procedures.
