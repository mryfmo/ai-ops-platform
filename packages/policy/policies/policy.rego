# 根拠: FinalArch:CON-004, FinalArch:CON-005, ADR-0023
package aiops.policy

import rego.v1

bundle_version := "0.1.0"
risk_dispositions := data.aiops.tool_risk_catalog.dispositions
globally_forbidden_actions := data.aiops.tool_risk_catalog.globally_forbidden

default decision := {
	"decision": "deny",
	"reasons": ["default_deny"],
	"obligations": {
		"allowedProvider": "none",
		"requireHumanApproval": false,
	},
	"policyBundleVersion": "0.1.0",
}

decision := {
	"decision": "allow",
	"reasons": [sprintf("registered_%s_tool", [tool.risk])],
	"obligations": {
		"allowedProvider": "none",
		"requireHumanApproval": false,
	},
	"policyBundleVersion": bundle_version,
} if {
	valid_input
	tool := registered_tool
	project_in_scope
	not tool.operation in globally_forbidden_actions
	disposition := risk_dispositions[tool.risk]
	disposition in {"allow", "allow_audit"}
}

decision := {
	"decision": "require_approval",
	"reasons": [risk_dispositions[tool.risk]],
	"obligations": {
		"allowedProvider": "none",
		"requireHumanApproval": true,
	},
	"policyBundleVersion": bundle_version,
} if {
	valid_input
	tool := registered_tool
	project_in_scope
	not tool.operation in globally_forbidden_actions
	disposition := risk_dispositions[tool.risk]
	disposition in {"require_batch_approval", "require_explicit_approval"}
}

registered_tool := tool if {
	some tool in data.aiops.tool_risk_catalog.tools
	input.action.toolName == sprintf("%s.%s.%s", [tool.server, tool.group, tool.operation])
	input.action.name == tool.operation
	input.action.riskLevel == tool.risk
	input.resource.system == tool.server
}

project_in_scope if {
	not "projectId" in object.keys(input.resource)
}

project_in_scope if {
	input.resource.projectId in input.actor.projectIds
}

valid_input if {
	is_object(input)
	object.keys(input) == {"actor", "agent", "action", "resource", "context"}
	valid_actor(input.actor)
	valid_agent(input.agent)
	valid_action(input.action)
	valid_resource(input.resource)
	valid_context(input.context)
}

valid_actor(actor) if {
	is_object(actor)
	is_string(actor.id)
	actor.type in {"human", "service", "agent"}
	is_string(actor.tenantId)
	valid_optional_string_array(actor, "groups")
	valid_optional_string_array(actor, "projectIds")
}

valid_agent(agent) if {
	is_object(agent)
	is_string(agent.id)
	agent.kind in {
		"control-api",
		"claude-code",
		"droid",
		"web-workbench",
		"teams-adapter",
		"temporal-worker",
	}
}

valid_action(action) if {
	is_object(action)
	is_string(action.name)
	action.riskLevel in {"L0", "L1", "L2", "L3", "L4", "L5", "L6"}
	valid_optional_string(action, "toolName")
	valid_optional_enum(action, "protocol", {"api", "mcp", "a2a", "llm", "ui"})
}

valid_resource(resource) if {
	is_object(resource)
	is_string(resource.system)
	is_string(resource.id)
	resource.classification in {
		"public",
		"internal",
		"confidential",
		"customer-confidential",
		"restricted",
	}
	valid_optional_string(resource, "projectId")
	valid_optional_string_array(resource, "labels")
}

valid_context(context) if {
	is_object(context)
	is_string(context.purpose)
	context.environment in {"dev", "staging", "prod"}
	valid_optional_enum(context, "providerCandidate", {"bedrock", "anthropic", "none"})
	valid_optional_string(context, "approvalId")
	valid_optional_enum(context, "sourceTrust", {"trusted-platform", "reviewed", "untrusted-content"})
}

valid_optional_string(value, key) if {
	not key in object.keys(value)
}

valid_optional_string(value, key) if {
	key in object.keys(value)
	is_string(value[key])
}

valid_optional_string_array(value, key) if {
	not key in object.keys(value)
}

valid_optional_string_array(value, key) if {
	key in object.keys(value)
	is_array(value[key])
	every item in value[key] {
		is_string(item)
	}
}

valid_optional_enum(value, key, allowed) if {
	not key in object.keys(value)
}

valid_optional_enum(value, key, allowed) if {
	key in object.keys(value)
	value[key] in allowed
}
