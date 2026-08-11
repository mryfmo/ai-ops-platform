# 根拠: FinalArch:CON-004, FinalArch:CON-005, ADR-0023
package aiops.policy_test

import rego.v1

import data.aiops.policy.decision
import data.aiops.policy.globally_forbidden_actions
import data.aiops.policy.risk_dispositions

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
