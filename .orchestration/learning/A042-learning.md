# A042 learning triage

## Observation

Serial merge waves can make accepted downstream PRs conflict only at generated artifacts or adjacent independent imports. The existing protocol—attempt GitHub update-branch, inspect the three-way conflict, proceed only for mechanically composable changes, then require a fresh green check run—handled both cases safely.

## Decision

Not promoted. This behavior is already encoded in the A042 task protocol and does not add a new reusable rule.
