# 根拠: FinalArch:CON-004, FinalArch:CON-005, FinalArch:WIQ-004, ADR-0023, ADR-0024
package aiops.policy_test

import rego.v1

import data.aiops.policy.decision
import data.aiops.policy.globally_forbidden_actions
import data.aiops.policy.risk_dispositions
import data.system.log.mask

valid_l1_input := {
	"actor": {
		"id": "user-1",
		"type": "human",
		"tenantId": "tenant-1",
		"projectIds": ["project-1"],
	},
	"agent": {"id": "gateway-1", "kind": "control-api"},
	"action": {
		"name": "read",
		"riskLevel": "L1",
		"toolName": "github.repo-investigation.read",
		"protocol": "mcp",
	},
	"resource": {
		"system": "github",
		"id": "mryfmo/ai-ops-platform",
		"projectId": "project-1",
		"classification": "internal",
	},
	"context": {
		"purpose": "repository investigation",
		"environment": "dev",
		"providerCandidate": "none",
		"sourceTrust": "trusted-platform",
	},
}

test_registered_l1_tool_is_allowed if {
	result := decision with input as valid_l1_input
	result.decision == "allow"
	result.obligations.requireHumanApproval == false
}

test_registered_l2_tool_requires_approval if {
	candidate := object.union(valid_l1_input, {
		"action": {
			"name": "draft",
			"riskLevel": "L2",
			"toolName": "plane.draft-work-item.draft",
			"protocol": "mcp",
		},
		"resource": {
			"system": "plane",
			"id": "work-item-draft-1",
			"projectId": "project-1",
			"classification": "internal",
		},
	})
	result := decision with input as candidate
	result.decision == "require_approval"
	result.obligations.requireHumanApproval == true
}

test_unknown_input_is_denied if {
	result := decision with input as {"unexpected": true}
	result.decision == "deny"
	result.reasons == ["default_deny"]
}

test_undefined_tool_is_denied if {
	candidate := object.union(valid_l1_input, {
		"action": {
			"name": "read",
			"riskLevel": "L1",
			"toolName": "github.undefined.read",
			"protocol": "mcp",
		},
	})
	result := decision with input as candidate
	result.decision == "deny"
}

test_tool_server_must_match_resource_system if {
	candidate := object.union(valid_l1_input, {
		"resource": {
			"system": "plane",
			"id": "work-item-1",
			"projectId": "project-1",
			"classification": "internal",
		},
	})
	result := decision with input as candidate
	result.decision == "deny"
}

test_project_scoped_resource_requires_actor_membership if {
	candidate := object.union(valid_l1_input, {
		"actor": {
			"id": "user-1",
			"type": "human",
			"tenantId": "tenant-1",
			"projectIds": ["project-2"],
		},
	})
	result := decision with input as candidate
	result.decision == "deny"
}

test_unknown_risk_is_denied if {
	candidate := object.union(valid_l1_input, {
		"action": {
			"name": "read",
			"riskLevel": "L7",
			"toolName": "github.repo-investigation.read",
			"protocol": "mcp",
		},
	})
	result := decision with input as candidate
	result.decision == "deny"
}

test_declared_risk_must_match_registered_tool if {
	candidate := object.union(valid_l1_input, {
		"action": {
			"name": "read",
			"riskLevel": "L0",
			"toolName": "github.repo-investigation.read",
			"protocol": "mcp",
		},
	})
	result := decision with input as candidate
	result.decision == "deny"
}

test_unknown_top_level_property_is_denied if {
	candidate := object.union(valid_l1_input, {"unexpected": true})
	result := decision with input as candidate
	result.decision == "deny"
}

test_globally_forbidden_action_stays_denied_if_misregistered if {
	candidate := object.union(valid_l1_input, {
		"action": {
			"name": "merge_pull_request",
			"riskLevel": "L1",
			"toolName": "github.repo-investigation.merge_pull_request",
			"protocol": "mcp",
		},
	})
	accidental_registration := [{
		"server": "github",
		"group": "repo-investigation",
		"operation": "merge_pull_request",
		"risk": "L1",
	}]
	result := decision with input as candidate with data.aiops.tool_risk_catalog.tools as accidental_registration
	result.decision == "deny"
	"merge_pull_request" in globally_forbidden_actions
}

test_risk_dispositions_match_the_canonical_catalog if {
	risk_dispositions == {
		"L0": "allow",
		"L1": "allow_audit",
		"L2": "require_batch_approval",
		"L3": "require_explicit_approval",
		"L4": "runner_only",
		"L5": "not_registered",
		"L6": "not_registered",
	}
}

test_l4_through_l6_are_denied_without_registered_tools if {
	every level in {"L4", "L5", "L6"} {
		candidate := object.union(valid_l1_input, {
			"action": {
				"name": "read",
				"riskLevel": level,
				"toolName": "github.repo-investigation.read",
				"protocol": "mcp",
			},
		})
		result := decision with input as candidate
		result.decision == "deny"
	}
}

test_missing_input_is_denied if {
	result := decision with input as {}
	result.decision == "deny"
	result.policyBundleVersion == "0.2.0"
}

test_catalog_outside_risk_stays_denied_if_accidentally_registered if {
	candidate := object.union(valid_l1_input, {
		"action": {
			"name": "read",
			"riskLevel": "L5",
			"toolName": "github.repo-investigation.read",
			"protocol": "mcp",
		},
	})
	accidental_registration := [{
		"server": "github",
		"group": "repo-investigation",
		"operation": "read",
		"risk": "L5",
	}]
	result := decision with input as candidate with data.aiops.tool_risk_catalog.tools as accidental_registration
	result.decision == "deny"
	result.policyBundleVersion == "0.2.0"
}

test_bundle_version_is_present_on_allow_approval_and_deny if {
	allow_result := decision with input as valid_l1_input
	approval_input := object.union(valid_l1_input, {
		"action": {
			"name": "draft",
			"riskLevel": "L2",
			"toolName": "plane.draft-work-item.draft",
			"protocol": "mcp",
		},
		"resource": {
			"system": "plane",
			"id": "work-item-draft-1",
			"projectId": "project-1",
			"classification": "internal",
		},
	})
	approval_result := decision with input as approval_input
	deny_result := decision with input as {}
	every result in {allow_result, approval_result, deny_result} {
		result.policyBundleVersion == "0.2.0"
	}
}

test_decision_log_mask_removes_caller_input if {
	mask == {"/input"}
}

m365_egress_input := {
	"actor": {
		"id": "user-1",
		"type": "human",
		"tenantId": "tenant-1",
		"projectIds": ["PJ-001"],
	},
	"agent": {"id": "control-plane", "kind": "temporal-worker"},
	"action": {
		"name": "egress",
		"riskLevel": "L1",
		"toolName": "work-iq.m365-intelligence.egress",
		"protocol": "llm",
	},
	"resource": {
		"system": "work-iq",
		"id": "work-iq-output",
		"projectId": "PJ-001",
		"classification": "customer-confidential",
		"labels": [
			"provenance:complete",
			"requested-field:response",
			"source-system:teams",
		],
	},
	"context": {
		"purpose": "answer a project status question",
		"environment": "dev",
		"providerCandidate": "bedrock",
		"sourceTrust": "trusted-platform",
	},
}

test_m365_restricted_is_denied_for_every_provider if {
	every provider in {"bedrock", "anthropic", "none"} {
		candidate := object.union(m365_egress_input, {
			"resource": object.union(m365_egress_input.resource, {"classification": "restricted"}),
			"context": object.union(m365_egress_input.context, {"providerCandidate": provider}),
		})
		result := decision with input as candidate
		result.decision == "deny"
		result.reasons == ["m365_restricted_no_egress"]
		result.obligations.allowedProvider == "none"
	}
}

test_m365_customer_confidential_is_bedrock_only_with_minimization if {
	result := decision with input as m365_egress_input
	result.decision == "allow"
	result.reasons == ["m365_customer_confidential_bedrock_minimized"]
	result.obligations == {
		"allowedProvider": "bedrock",
		"maxResultBytes": 4096,
		"redactFields": ["conversationId", "permissionContext", "sourceReferences"],
		"requireHumanApproval": false,
	}
}

test_m365_customer_confidential_anthropic_is_denied if {
	candidate := object.union(m365_egress_input, {
		"context": object.union(m365_egress_input.context, {"providerCandidate": "anthropic"}),
	})
	result := decision with input as candidate
	result.decision == "deny"
}

test_m365_anthropic_requires_explicit_policy_data if {
	public_input := object.union(m365_egress_input, {
		"resource": object.union(m365_egress_input.resource, {"classification": "public"}),
		"context": object.union(m365_egress_input.context, {"providerCandidate": "anthropic"}),
	})
	default_result := decision with input as public_input
	default_result.decision == "deny"

	explicit_result := decision with input as public_input with data.aiops.m365_egress as {
		"anthropicDirectClassifications": ["public"],
	}
	explicit_result.decision == "allow"
	explicit_result.obligations.allowedProvider == "anthropic"
}

test_m365_confidential_stays_bedrock_only_even_if_anthropic_data_drifts if {
	candidate := object.union(m365_egress_input, {
		"resource": object.union(m365_egress_input.resource, {"classification": "confidential"}),
		"context": object.union(m365_egress_input.context, {"providerCandidate": "anthropic"}),
	})
	result := decision with input as candidate with data.aiops.m365_egress as {
		"anthropicDirectClassifications": ["confidential"],
	}
	result.decision == "deny"
}

test_m365_bedrock_staged_classification_rules if {
	every classification in {"public", "internal", "confidential"} {
		candidate := object.union(m365_egress_input, {
			"resource": object.union(m365_egress_input.resource, {"classification": classification}),
		})
		result := decision with input as candidate
		result.decision == "allow"
		result.obligations.allowedProvider == "bedrock"
	}
}

test_m365_unknown_classification_is_denied if {
	candidate := object.union(m365_egress_input, {
		"resource": object.union(m365_egress_input.resource, {"classification": "unknown"}),
	})
	result := decision with input as candidate
	result.decision == "deny"
}

test_m365_incomplete_provenance_cannot_claim_a_lower_classification if {
	candidate := object.union(m365_egress_input, {
		"resource": object.union(m365_egress_input.resource, {
			"classification": "internal",
			"labels": [
				"provenance:incomplete",
				"requested-field:response",
				"source-system:teams",
			],
		}),
	})
	result := decision with input as candidate
	result.decision == "deny"
}

test_m365_egress_requires_requested_fields_and_source_systems if {
	every labels in {
		["provenance:complete", "source-system:teams"],
		["provenance:complete", "requested-field:response"],
	} {
		candidate := object.union(m365_egress_input, {
			"resource": object.union(m365_egress_input.resource, {"labels": labels}),
		})
		result := decision with input as candidate
		result.decision == "deny"
	}
}
