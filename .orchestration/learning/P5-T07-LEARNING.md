# P5-T07 Learning

## Reusable Findings

1. A critical egress invariant needs two independent stops: policy denies restricted data, and the dispatch boundary rejects restricted even if policy is misconfigured or compromised.
2. Incomplete Work IQ provenance must raise classification before policy input; Rego should independently reject incomplete provenance paired with a lower classification so caller drift cannot relax the route.
3. Redaction/minimization obligations are safer when enforced by deterministic field selection and deletion, not represented as a promise that another component applied them.
4. A policy-provided byte limit still needs a platform absolute ceiling; otherwise a drifted allow decision can make the nominal bound meaningless.
5. A policy bundle semver bump must move the Rego default, client expectation, deployment bundle revision, and smoke expectation together.
6. Field allowlisting and metadata redaction do not replace secret sanitization: retained values still need the shared sanitizer immediately before LLM dispatch, followed by the byte-limit check.
7. Redaction obligations name data fields, not only top-level paths; a JSON serialization replacer is the minimal deterministic way to prevent the same metadata from escaping when nested.

## Apply To

- Later P5 Work IQ egress/source-reference tasks, generic tool-result-to-LLM boundaries, and policy bundle release procedures.
