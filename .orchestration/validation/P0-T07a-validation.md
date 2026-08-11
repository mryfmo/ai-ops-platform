<!-- 根拠: ENV-DEC-001 / ADR-0029 / FinalArch:GOV-003 -->

# P0-T07a Validation

## Test-first baseline

- Before editing, the P3-T01 Fargate deliverable assertion failed.
- Before editing, the IMPORT_NOTES AWS mapping assertion failed.
- Before editing, the P0-T09 matrix still contained Azure premises.
- Before editing, `shasum -a 256 -c SHA256SUMS` had exactly one failure:
  `BASELINE.md`.

## Content and boundary checks

- P3-T01 contains the exact ENV-DEC-001 deliverable and no Cloud namespace
  deliverable. Its verification requires denial outside worker scope and for
  admin/operator APIs.
- P0-T09 contains no Azure / Key Vault / ACA / AKS / Bedrock-federation
  premise; its M365-only Entra rows remain explicit.
- IMPORT_NOTES contains ACA, Key Vault, Entra Workload ID, Bicep, Azure
  Monitor, Front Door, PostgreSQL, and container-registry AWS mappings.
- `git diff --check`: pass.
- Tracked diff is restricted to the four requested canonical/checksum paths;
  BASELINE.md is unchanged.
- `make -C docs/plans/2026-08-final-architecture validate`: pass;
  113 WBS tasks, 64 acceptance gates, 101 files.
- gitleaks v8.30.1 directory scans of `docs` and task evidence: pass.
- `make require-crit-review`: unavailable; the repository has no such target.

## Full Definition of Done

Fresh PostgreSQL 16 cluster on loopback port `55445`, with dedicated
`aiops_test`, `aiops_load_test`, and `aiops_p001` databases:

```text
env CI=true PGHOST=127.0.0.1 PGPORT=55445 PGUSER=postgres AIOPS_TEST_DATABASE_NAME=aiops_test AIOPS_TEST_DATABASE_HOST=127.0.0.1 AIOPS_TEST_DATABASE_PORT=55445 AIOPS_LOAD_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55445/aiops_load_test AIOPS_LOAD_TEST_CONFIRM_DATABASE=aiops_load_test TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55445/aiops_p001 P001_ALLOW_DISPOSABLE_DB=1 mise run ci
```

Result: exit 0. Governance, audit threshold, actionlint, lint, traceability,
format, build, typecheck, coverage, and PostgreSQL integration passed.
Coverage ran 183 test files / 2,304 tests; PostgreSQL reported
`P001 PostgreSQL integration passed`.

## SHA256SUMS full output

```text
./00_governance/01_product_intent_and_invariants.md: OK
./00_governance/02_decision_authority_and_drift_control.md: OK
./00_governance/03_system_of_record_matrix.md: OK
./00_governance/04_non_goals_and_exclusions.md: OK
./01_current_state/01_repository_assessment.md: OK
./01_current_state/02_gap_analysis.md: OK
./01_current_state/03_repository_change_map.md: OK
./02_requirements/01_product_requirements.md: OK
./02_requirements/02_functional_specification.md: OK
./02_requirements/03_non_functional_requirements.md: OK
./02_requirements/04_use_cases.md: OK
./02_requirements/05_traceability_matrix.csv: OK
./03_architecture/01_target_architecture.md: OK
./03_architecture/02_runtime_and_deployment.md: OK
./03_architecture/03_security_and_trust_boundaries.md: OK
./03_architecture/04_data_event_and_identity.md: OK
./03_architecture/05_knowledge_and_meeting_architecture.md: OK
./03_architecture/06_model_and_tool_routing.md: OK
./03_architecture/07_failure_modes_and_resilience.md: OK
./04_component_specs/01_control_api_temporal.md: OK
./04_component_specs/02_litellm.md: OK
./04_component_specs/03_agentgateway_mcp_a2a.md: OK
./04_component_specs/04_work_iq_graph.md: OK
./04_component_specs/05_opentag_teams.md: OK
./04_component_specs/06_web_workbench.md: OK
./04_component_specs/07_wispr_confluence_sharepoint.md: OK
./04_component_specs/08_plane_github.md: OK
./04_component_specs/09_coding_agents.md: OK
./04_component_specs/10_observability_audit.md: OK
./05_contracts/control-api.openapi.yaml: OK
./05_contracts/domain-schemas.json: OK
./05_contracts/events.asyncapi.yaml: OK
./05_contracts/ledger-migration-design.sql: OK
./05_contracts/mcp-registry-manifest.yaml: OK
./05_contracts/model-routing.yaml: OK
./05_contracts/policy-decision.schema.json: OK
./05_contracts/policy-input.schema.json: OK
./05_contracts/tool-risk-catalog.yaml: OK
./06_implementation/01_master_plan.md: OK
./06_implementation/02_wbs.yaml: OK
./06_implementation/03_phase_acceptance.md: OK
./06_implementation/04_branch_pr_strategy.md: OK
./06_implementation/05_migration_rollout_rollback.md: OK
./06_implementation/06_dependency_and_version_policy.md: OK
./06_implementation/07_file_by_file_change_plan.md: OK
./06_implementation/08_feature_flags.yaml: OK
./06_implementation/09_owner_decision_register.md: OK
./06_implementation/10_wbs_task_summary.md: OK
./07_agent_execution/AGENTS_ADDENDUM.md: OK
./07_agent_execution/CHANGE_BOUNDARIES.yaml: OK
./07_agent_execution/CLAUDE_CODE_FABLE5_XHIGH.md: OK
./07_agent_execution/CODEX_GPT56_SOL_HIGH.md: OK
./07_agent_execution/COMPLETION_EVIDENCE_TEMPLATE.yaml: OK
./07_agent_execution/EXECUTION_PROMPT_TEMPLATE.md: OK
./07_agent_execution/HANDOFF_PROTOCOL.md: OK
./07_agent_execution/REVIEW_PROMPT_TEMPLATE.md: OK
./07_agent_execution/TASK_MANIFEST_TEMPLATE.yaml: OK
./07_agent_execution/TASK_ROUTING.yaml: OK
./08_verification/01_test_strategy.md: OK
./08_verification/02_acceptance_test_catalog.yaml: OK
./08_verification/03_security_test_plan.md: OK
./08_verification/04_resilience_chaos_plan.md: OK
./08_verification/05_compatibility_matrix.md: OK
./08_verification/06_release_readiness_checklist.md: OK
./09_operations/01_runbook.md: OK
./09_operations/02_slo_sli.md: OK
./09_operations/03_incident_response.md: OK
./09_operations/04_backup_restore.md: OK
./09_operations/05_upgrade_rollback.md: OK
./10_adrs/0020-final-layered-platform.md: OK
./10_adrs/0021-temporal-durable-control-plane.md: OK
./10_adrs/0022-litellm-bedrock-anthropic.md: OK
./10_adrs/0023-agentgateway-opa-access.md: OK
./10_adrs/0024-work-iq-graph-separation.md: OK
./10_adrs/0025-teams-workbench-surfaces.md: OK
./10_adrs/0026-meeting-knowledge-records.md: OK
./10_adrs/0027-ai-coding-one-writer.md: OK
./10_adrs/0028-no-cloudflare-artifacts-azure.md: OK
./11_diagrams/01_system_context.mmd: OK
./11_diagrams/02_container_architecture.mmd: OK
./11_diagrams/03_meeting_sequence.mmd: OK
./11_diagrams/04_coding_task_sequence.mmd: OK
./11_diagrams/05_incident_sequence.mmd: OK
./11_diagrams/06_data_authority.mmd: OK
./11_diagrams/07_trust_boundaries.mmd: OK
./11_diagrams/08_deployment.mmd: OK
./11_diagrams/09_migration_state.mmd: OK
./11_diagrams/10_approval_state_machine.mmd: OK
./APPLY_TO_REPOSITORY.md: OK
./BASELINE.md: OK
./DOCUMENT_INDEX.md: OK
./IMPORT_NOTES.md: OK
./Makefile: OK
./PACK_MANIFEST.yaml: OK
./scripts/render_task_summary.py: OK
./scripts/validate_pack.py: OK
./SOURCE_REGISTER.md: OK
./START_HERE.md: OK
./VALIDATION_REPORT.md: OK
```
