# 根拠: FinalArch:PRD-010 / FinalArch:FR-CP-008 / ADR-0029 / REL-001 / P10-T01 / P10-T03
terraform {
  required_version = ">= 1.7.0, < 2.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 5.100.0"
    }
  }
}

variable "names" {
  type = set(string)
  validation {
    condition     = length(var.names) > 0
    error_message = "at least one secret name is required."
  }
}

variable "recovery_window_in_days" {
  type    = number
  default = 30
  validation {
    condition     = var.recovery_window_in_days >= 7 && var.recovery_window_in_days <= 30
    error_message = "recovery_window_in_days must be between 7 and 30."
  }
}

variable "environment" {
  type     = string
  default  = null
  nullable = true
  validation {
    condition     = var.environment == null || contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod when KMS controls are enabled."
  }
}

variable "create_kms_key" {
  type    = bool
  default = false
}

variable "workload_role_name_prefix" {
  type     = string
  default  = null
  nullable = true
}

variable "service_secret_names" {
  type    = map(set(string))
  default = {}
  validation {
    condition     = alltrue([for service in keys(var.service_secret_names) : contains(["server", "litellm", "temporal", "agentgateway", "opa"], service)])
    error_message = "secret mappings may target only server, litellm, temporal, agentgateway, or opa."
  }
}

variable "kms_administrator_role_arns" {
  type    = set(string)
  default = []
}

variable "rotation_secret_names" {
  type    = set(string)
  default = []
}

variable "enable_rotation" {
  type    = bool
  default = false
}

variable "rotation_lambda_arn" {
  type     = string
  default  = null
  nullable = true
}

variable "rotation_role_arn" {
  type     = string
  default  = null
  nullable = true
}

variable "bootstrap_role_arn" {
  type     = string
  default  = null
  nullable = true
}

variable "rotation_days" {
  type    = number
  default = 30
  validation {
    condition     = var.rotation_days >= 7 && var.rotation_days <= 365
    error_message = "rotation_days must be between 7 and 365."
  }
}

variable "tags" {
  type = map(string)
}

data "aws_partition" "current" {}
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

locals {
  root_principal_arn = "arn:${data.aws_partition.current.partition}:iam::${data.aws_caller_identity.current.account_id}:root"
  workload_principals_by_secret = {
    for secret_name in var.names : secret_name => flatten([
      for service, names in var.service_secret_names : contains(names, secret_name) ? [
        "arn:${data.aws_partition.current.partition}:iam::${data.aws_caller_identity.current.account_id}:role/${var.workload_role_name_prefix}-${service}-execution",
        "arn:${data.aws_partition.current.partition}:iam::${data.aws_caller_identity.current.account_id}:role/${var.workload_role_name_prefix}-${service}-task"
      ] : []
    ])
  }
  all_workload_principals = distinct(flatten(values(local.workload_principals_by_secret)))
  privileged_secret_principals = compact(concat(
    [local.root_principal_arn],
    local.all_workload_principals,
    [var.rotation_role_arn]
  ))
}

resource "aws_kms_key" "secrets" {
  count                   = var.create_kms_key ? 1 : 0
  description             = "Environment-scoped Secrets Manager key for ${var.workload_role_name_prefix}"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [{
        Sid       = "EnableAccountAdministration"
        Effect    = "Allow"
        Principal = { AWS = local.root_principal_arn }
        Action    = ["kms:*"]
        Resource  = "*"
      }],
      length(var.kms_administrator_role_arns) == 0 ? [] : [{
        Sid       = "KeyAdministrators"
        Effect    = "Allow"
        Principal = { AWS = var.kms_administrator_role_arns }
        Action = [
          "kms:Create*", "kms:Describe*", "kms:Enable*", "kms:List*", "kms:Put*",
          "kms:Update*", "kms:Revoke*", "kms:Disable*", "kms:Get*", "kms:Delete*",
          "kms:TagResource", "kms:UntagResource", "kms:ScheduleKeyDeletion", "kms:CancelKeyDeletion"
        ]
        Resource = "*"
      }],
      length(local.privileged_secret_principals) == 1 ? [] : [{
        Sid       = "SecretsManagerKeyUsers"
        Effect    = "Allow"
        Principal = { AWS = "*" }
        Action    = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey*", "kms:DescribeKey"]
        Resource  = "*"
        Condition = {
          ArnEquals    = { "aws:PrincipalArn" = slice(local.privileged_secret_principals, 1, length(local.privileged_secret_principals)) }
          StringEquals = { "kms:ViaService" = "secretsmanager.${data.aws_region.current.name}.amazonaws.com" }
        }
      }],
      var.bootstrap_role_arn == null ? [] : [{
        Sid       = "SecretsManagerBootstrapKeyUser"
        Effect    = "Allow"
        Principal = { AWS = "*" }
        Action    = ["kms:Encrypt", "kms:GenerateDataKey*", "kms:DescribeKey"]
        Resource  = "*"
        Condition = {
          ArnEquals    = { "aws:PrincipalArn" = var.bootstrap_role_arn }
          StringEquals = { "kms:ViaService" = "secretsmanager.${data.aws_region.current.name}.amazonaws.com" }
        }
      }]
    )
  })
  tags = merge(var.tags, { Name = "${var.workload_role_name_prefix}-secrets", Environment = var.environment })

  lifecycle {
    precondition {
      condition     = var.environment != null && var.workload_role_name_prefix != null && length(var.kms_administrator_role_arns) > 0
      error_message = "create_kms_key requires environment, workload_role_name_prefix, and a separate KMS administrator role."
    }
  }
}

resource "aws_kms_alias" "secrets" {
  count         = var.create_kms_key ? 1 : 0
  name          = "alias/${var.workload_role_name_prefix}-secrets"
  target_key_id = aws_kms_key.secrets[0].key_id
}

resource "aws_secretsmanager_secret" "this" {
  for_each                = var.names
  name                    = each.key
  description             = "Value is injected by the environment bootstrap; Terraform creates no secret version."
  kms_key_id              = var.create_kms_key ? aws_kms_key.secrets[0].arn : null
  recovery_window_in_days = var.recovery_window_in_days
  tags = merge(
    var.tags,
    { Name = each.key },
    var.environment == null ? {} : { Environment = var.environment }
  )

  lifecycle {
    precondition {
      condition = var.workload_role_name_prefix == null || (var.create_kms_key &&
        var.bootstrap_role_arn != null &&
        startswith(each.key, "${var.workload_role_name_prefix}/") &&
        contains(toset(flatten([for names in values(var.service_secret_names) : tolist(names)])), each.key)
      )
      error_message = "every protected secret requires a bootstrap role, the environment prefix, and at least one service mapping."
    }
    precondition {
      condition = !var.enable_rotation || (
        length(var.rotation_secret_names) > 0 &&
        var.rotation_lambda_arn != null &&
        var.rotation_role_arn != null &&
        length(setsubtract(var.rotation_secret_names, var.names)) == 0
      )
      error_message = "rotation requires Lambda and role ARNs, and every rotated secret must be declared."
    }
  }
}

resource "aws_secretsmanager_secret_policy" "workload" {
  for_each            = var.workload_role_name_prefix == null ? toset([]) : var.names
  secret_arn          = aws_secretsmanager_secret.this[each.key].arn
  block_public_policy = true
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [{
        Sid       = "DenyUnexpectedPrincipals"
        Effect    = "Deny"
        Principal = { AWS = "*" }
        Action    = ["secretsmanager:GetSecretValue", "secretsmanager:BatchGetSecretValue", "secretsmanager:PutSecretValue", "secretsmanager:UpdateSecretVersionStage"]
        Resource  = "*"
        Condition = {
          ArnNotEquals = {
            "aws:PrincipalArn" = distinct(concat(
              [local.root_principal_arn],
              local.workload_principals_by_secret[each.key],
              compact([
                var.bootstrap_role_arn,
                contains(var.rotation_secret_names, each.key) ? var.rotation_role_arn : null
              ])
            ))
          }
        }
      }],
      length(local.workload_principals_by_secret[each.key]) == 0 ? [] : [{
        Sid       = "AllowMappedWorkloads"
        Effect    = "Allow"
        Principal = { AWS = "*" }
        Action    = ["secretsmanager:GetSecretValue", "secretsmanager:BatchGetSecretValue", "secretsmanager:DescribeSecret"]
        Resource  = "*"
        Condition = { ArnEquals = { "aws:PrincipalArn" = local.workload_principals_by_secret[each.key] } }
      }],
      var.bootstrap_role_arn == null ? [] : [{
        Sid       = "AllowBootstrap"
        Effect    = "Allow"
        Principal = { AWS = "*" }
        Action    = ["secretsmanager:DescribeSecret", "secretsmanager:PutSecretValue"]
        Resource  = "*"
        Condition = { ArnEquals = { "aws:PrincipalArn" = var.bootstrap_role_arn } }
      }],
      var.rotation_role_arn == null || !contains(var.rotation_secret_names, each.key) ? [] : [{
        Sid       = "AllowRotation"
        Effect    = "Allow"
        Principal = { AWS = "*" }
        Action    = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret", "secretsmanager:PutSecretValue", "secretsmanager:UpdateSecretVersionStage"]
        Resource  = "*"
        Condition = { ArnEquals = { "aws:PrincipalArn" = var.rotation_role_arn } }
      }]
    )
  })
}

resource "aws_lambda_permission" "rotation" {
  for_each       = var.enable_rotation ? var.rotation_secret_names : toset([])
  statement_id   = "AllowSecretsManager-${substr(sha1(each.key), 0, 12)}"
  action         = "lambda:InvokeFunction"
  function_name  = var.rotation_lambda_arn
  principal      = "secretsmanager.amazonaws.com"
  source_arn     = aws_secretsmanager_secret.this[each.key].arn
  source_account = data.aws_caller_identity.current.account_id
}

resource "aws_secretsmanager_secret_rotation" "this" {
  for_each            = var.enable_rotation ? var.rotation_secret_names : toset([])
  secret_id           = aws_secretsmanager_secret.this[each.key].id
  rotation_lambda_arn = var.rotation_lambda_arn
  depends_on          = [aws_lambda_permission.rotation]

  rotation_rules {
    automatically_after_days = var.rotation_days
  }

  lifecycle {
    precondition {
      condition     = var.rotation_role_arn != null && contains(var.names, each.key)
      error_message = "rotation requires a declared secret and rotation_role_arn."
    }
  }
}

output "secret_arns" {
  value = { for name, secret in aws_secretsmanager_secret.this : name => secret.arn }
}

output "kms_key_arn" {
  value = var.create_kms_key ? aws_kms_key.secrets[0].arn : null
}
