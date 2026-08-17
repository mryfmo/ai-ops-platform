# GOV-003-P8-T03-AMENDMENT Report

- Worker: `codex-deep-dot`
- Branch: `agent/GOV-003-p8-t03-amendment`
- Base: `1d49f2362283ee100ba3d68a894f5ba4cbad673c`
- Scope: P8-T03 WBS amendment and Owner-signature decision record only

## Result

[memory:decision] P8-T03 now owns both job-scoped LiteLLM virtual-key and
GitHub App installation-token lifecycles. The installation token is narrowed to
one repository and minimum push/PR permissions and is injected only into the
dedicated push/PR steps.

[memory:decision] Workflow-to-issuer authentication is GitHub OIDC with an
audience-bound token. Missing endpoint configuration, missing OIDC, or a wrong
audience must fail closed; LiteLLM master/provider keys and the GitHub App
private key never enter the runner.

[memory:decision] Owner merge of the amendment PR is the GOV-003 signature.
Before that merge P8-T03 implementation stays frozen. P8-T03 proves PAT-removal
readiness; P10-T10 retains ownership of final repository-secret deletion.

## Delivered

- Amended WBS P8-T03 deliverables, acceptance, verification, and allowed test path.
- Added a Proposed decision record whose Owner merge is the explicit signature event.
- Added the pack delta ledger entry and regenerated the complete checksum register.
- Preserved all implementation files and open PR #260/#261/#262 paths unchanged.

## Evidence

- Validation: `.orchestration/validation/GOV-003-P8-T03-AMENDMENT-VALIDATION.md`
- Sandbox: `.orchestration/sandboxes/GOV-003-P8-T03-AMENDMENT-SANDBOX.md`
- Learning: `.orchestration/learning/GOV-003-P8-T03-AMENDMENT-LEARNING.md`
- AutoSkill: `.orchestration/autoskill/runs/GOV-003-P8-T03-AMENDMENT.md`

## Remaining gate

This docs-only commit does not authorize implementation. P8-T03 resumes only
after the Owner merges the amendment PR; live issuer/LiteLLM/GitHub evidence
remains environment-gated.
