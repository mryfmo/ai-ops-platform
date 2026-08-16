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
  mock_resource "aws_secretsmanager_secret" {
    defaults = {
      arn = "arn:aws:secretsmanager:ap-northeast-1:000000000000:secret:mock-secret-000000"
      id  = "arn:aws:secretsmanager:ap-northeast-1:000000000000:secret:mock-secret-000000"
    }
  }
}

variables {
  names = [
    "aiops-dev/server/entra-client-secret",
    "aiops-dev/litellm/master-key",
    "aiops-dev/temporal/database-password"
  ]
  environment               = "dev"
  create_kms_key            = true
  workload_role_name_prefix = "aiops-dev"
  service_secret_names = {
    server   = ["aiops-dev/server/entra-client-secret"]
    litellm  = ["aiops-dev/litellm/master-key"]
    temporal = ["aiops-dev/temporal/database-password"]
  }
  kms_administrator_role_arns = ["arn:aws:iam::000000000000:role/security-kms-admin"]
  rotation_secret_names       = ["aiops-dev/server/entra-client-secret"]
  rotation_lambda_arn         = "arn:aws:lambda:ap-northeast-1:000000000000:function:placeholder-secret-rotation"
  rotation_role_arn           = "arn:aws:iam::000000000000:role/placeholder-secret-rotation"
  bootstrap_role_arn          = "arn:aws:iam::000000000000:role/placeholder-secret-bootstrap"
  enable_rotation             = true
  tags = {
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}

run "kms_and_secret_policies_are_environment_scoped" {
  command = plan

  assert {
    condition     = aws_kms_key.secrets[0].enable_key_rotation
    error_message = "The environment Secrets Manager CMK must enable KMS key rotation."
  }

  assert {
    condition = (
      strcontains(aws_kms_key.secrets[0].policy, "kms:ViaService") &&
      strcontains(aws_kms_key.secrets[0].policy, "secretsmanager.ap-northeast-1.amazonaws.com")
    )
    error_message = "KMS use must be limited to Secrets Manager in the environment region."
  }

  assert {
    condition = alltrue([
      for policy in values(aws_secretsmanager_secret_policy.workload) : policy.block_public_policy
    ])
    error_message = "Every workload secret policy must enable BlockPublicPolicy."
  }

  assert {
    condition = (
      strcontains(aws_secretsmanager_secret_policy.workload["aiops-dev/litellm/master-key"].policy, "aiops-dev-litellm-task") &&
      !strcontains(aws_secretsmanager_secret_policy.workload["aiops-dev/litellm/master-key"].policy, "aiops-dev-temporal-task") &&
      strcontains(aws_secretsmanager_secret_policy.workload["aiops-dev/litellm/master-key"].policy, "DenyUnexpectedPrincipals")
    )
    error_message = "A LiteLLM secret must allow only mapped environment roles and explicitly deny all others."
  }
}

run "rotation_is_bounded" {
  command = plan

  assert {
    condition = (
      strcontains(aws_secretsmanager_secret_policy.workload["aiops-dev/server/entra-client-secret"].policy, var.rotation_role_arn) &&
      !strcontains(aws_secretsmanager_secret_policy.workload["aiops-dev/litellm/master-key"].policy, var.rotation_role_arn)
    )
    error_message = "The rotation role must be exempted only on secrets it rotates."
  }

  assert {
    condition     = aws_secretsmanager_secret_rotation.this["aiops-dev/server/entra-client-secret"].rotation_rules[0].automatically_after_days == 30
    error_message = "Managed rotation must use the bounded default cadence."
  }

  assert {
    condition = (
      aws_lambda_permission.rotation["aiops-dev/server/entra-client-secret"].principal == "secretsmanager.amazonaws.com" &&
      aws_lambda_permission.rotation["aiops-dev/server/entra-client-secret"].function_name == var.rotation_lambda_arn &&
      aws_lambda_permission.rotation["aiops-dev/server/entra-client-secret"].source_account == "000000000000"
    )
    error_message = "Each rotation schedule requires a same-account Secrets Manager invoke permission on the supplied Lambda."
  }

}

run "bootstrap_writer_can_initialize_every_declared_secret" {
  command = plan

  assert {
    condition = alltrue([
      for policy in values(aws_secretsmanager_secret_policy.workload) :
      anytrue([
        for statement in jsondecode(policy.policy).Statement :
        statement.Sid == "AllowBootstrap" &&
        statement.Condition.ArnEquals["aws:PrincipalArn"] == var.bootstrap_role_arn &&
        contains(statement.Action, "secretsmanager:PutSecretValue")
      ])
    ])
    error_message = "The environment bootstrap role must be able to initialize every declared secret, including non-rotated secrets."
  }

  assert {
    condition = (
      !strcontains(aws_secretsmanager_secret_policy.workload["aiops-dev/litellm/master-key"].policy, "AllowRotation") &&
      strcontains(aws_secretsmanager_secret_policy.workload["aiops-dev/litellm/master-key"].policy, "AllowBootstrap") &&
      alltrue([
        for action in one([
          for statement in jsondecode(aws_secretsmanager_secret_policy.workload["aiops-dev/litellm/master-key"].policy).Statement :
          statement.Action if statement.Sid == "AllowBootstrap"
        ]) : !contains(["secretsmanager:GetSecretValue", "secretsmanager:UpdateSecretVersionStage"], action)
      ])
    )
    error_message = "Bootstrap write access must not broaden rotation, read, or stage-management access on non-rotated secrets."
  }

  assert {
    condition = anytrue([
      for statement in jsondecode(aws_kms_key.secrets[0].policy).Statement :
      statement.Sid == "SecretsManagerBootstrapKeyUser" &&
      statement.Condition.ArnEquals["aws:PrincipalArn"] == var.bootstrap_role_arn &&
      contains(statement.Action, "kms:GenerateDataKey*") &&
      !contains(statement.Action, "kms:Decrypt")
    ])
    error_message = "The bootstrap role must encrypt the initial version through Secrets Manager without decrypt permission."
  }
}

run "rotation_stays_disabled_before_secret_bootstrap" {
  command = plan

  variables {
    enable_rotation = false
  }

  assert {
    condition = (
      length(aws_lambda_permission.rotation) == 0 &&
      length(aws_secretsmanager_secret_rotation.this) == 0
    )
    error_message = "Rotation permission and schedule must remain absent until the external bootstrap gate explicitly enables them."
  }
}
