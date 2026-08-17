# 根拠: FinalArch:PRD-010 / FinalArch:FR-CP-008 / ADR-0029 / REL-001 / P10-T03
mock_provider "aws" {
  override_during = plan

  mock_data "aws_partition" {
    defaults = { partition = "aws" }
  }
  mock_data "aws_region" {
    defaults = { name = "ap-northeast-1" }
  }
  mock_data "aws_caller_identity" {
    defaults = { account_id = "000000000000" }
  }
}

variables {
  name                    = "aiops-dev"
  environment             = "dev"
  github_repository       = "placeholder/ai-ops-platform"
  github_oidc_thumbprints = ["0000000000000000000000000000000000000000"]
  ecr_repository_arns     = ["arn:aws:ecr:ap-northeast-1:000000000000:repository/aiops-dev/legacy"]
  secret_arns             = []
  service_ecr_repository_arns = {
    server  = ["arn:aws:ecr:ap-northeast-1:000000000000:repository/aiops-dev/server"]
    litellm = ["arn:aws:ecr:ap-northeast-1:000000000000:repository/aiops-dev/litellm"]
  }
  service_secret_names = {
    server   = ["aiops-dev/server/entra-client-secret"]
    litellm  = ["aiops-dev/litellm/master-key"]
    temporal = ["aiops-dev/temporal/database-password"]
  }
  secrets_kms_key_arn = "arn:aws:kms:ap-northeast-1:000000000000:key/00000000-0000-0000-0000-000000000000"
  bedrock_model_arns = [
    "arn:aws:bedrock:ap-northeast-1::foundation-model/placeholder.model-v1"
  ]
  github_deployment_policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "ecs:UpdateService"
      Resource = "arn:aws:ecs:ap-northeast-1:000000000000:service/aiops-dev/*"
    }]
  })
  tags = {
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}

run "service_roles_are_isolated" {
  command = plan

  assert {
    condition     = toset(keys(aws_iam_role.service_task)) == toset(["server", "litellm", "temporal", "agentgateway", "opa"])
    error_message = "P10-T03 requires one task role for each fixed service boundary."
  }

  assert {
    condition     = toset(keys(aws_iam_role.service_execution)) == toset(["server", "litellm", "temporal", "agentgateway", "opa"])
    error_message = "P10-T03 requires one execution role for each fixed service boundary."
  }

  assert {
    condition = (
      strcontains(aws_iam_role_policy.service_task["litellm"].policy, "bedrock:InvokeModel") &&
      !strcontains(aws_iam_role_policy.service_task["server"].policy, "bedrock:InvokeModel")
    )
    error_message = "Only LiteLLM may receive Bedrock invocation permission."
  }

  assert {
    condition = (
      strcontains(aws_iam_role_policy.service_task["litellm"].policy, "aiops-dev/litellm/master-key-??????") &&
      !strcontains(aws_iam_role_policy.service_task["litellm"].policy, "aiops-dev/temporal/database-password")
    )
    error_message = "LiteLLM must not read Temporal secrets."
  }

  assert {
    condition = alltrue([
      for policy in values(aws_iam_role_policy.service_task) :
      strcontains(policy.policy, "iam:CreateAccessKey") && strcontains(policy.policy, "sts:AssumeRole")
    ])
    error_message = "Every task role needs explicit long-lived-key and role-chaining denial."
  }
}

run "github_oidc_is_exact_and_environment_bounded" {
  command = apply

  assert {
    condition = (
      jsondecode(aws_iam_role.github_deploy.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:aud"] == "sts.amazonaws.com" &&
      jsondecode(aws_iam_role.github_deploy.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"] == "repo:placeholder/ai-ops-platform:environment:dev"
    )
    error_message = "GitHub OIDC trust must bind the exact audience, repository, and protected environment."
  }

  assert {
    condition = alltrue([
      for sid in ["DenyLongLivedCredentials", "DenyRoleChaining", "DenyCrossEnvironmentSecrets", "DenyCrossEnvironmentKms", "DenyKmsTagMutation"] :
      contains([for statement in jsondecode(aws_iam_role_policy.github_guardrails.policy).Statement : statement.Sid], sid)
    ])
    error_message = "GitHub deploy role must retain explicit credential, assume-role, cross-environment, and KMS tag-mutation denials."
  }
}
