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

variable "name" {
  type = string
}

variable "environment" {
  type = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod."
  }
}

variable "github_repository" {
  type = string
  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "github_repository must use owner/repository syntax."
  }
}

variable "github_oidc_thumbprints" {
  type = list(string)
  validation {
    condition     = length(var.github_oidc_thumbprints) > 0 && alltrue([for value in var.github_oidc_thumbprints : can(regex("^[0-9a-f]{40}$", value))])
    error_message = "github_oidc_thumbprints must contain lowercase SHA-1 thumbprints."
  }
}

variable "ecr_repository_arns" {
  type = list(string)
}

variable "secret_arns" {
  type = list(string)
}

variable "service_ecr_repository_arns" {
  type    = map(set(string))
  default = {}
  validation {
    condition     = alltrue([for service in keys(var.service_ecr_repository_arns) : contains(["server", "litellm", "temporal", "agentgateway", "opa"], service)])
    error_message = "service ECR mappings may target only server, litellm, temporal, agentgateway, or opa."
  }
}

variable "service_secret_names" {
  type    = map(set(string))
  default = {}
  validation {
    condition     = alltrue([for service in keys(var.service_secret_names) : contains(["server", "litellm", "temporal", "agentgateway", "opa"], service)])
    error_message = "service secrets may target only server, litellm, temporal, agentgateway, or opa."
  }
}

variable "secrets_kms_key_arn" {
  type      = string
  default   = null
  nullable  = true
  sensitive = true
}

variable "bedrock_model_arns" {
  type    = set(string)
  default = []
}

variable "github_deployment_policy_json" {
  type      = string
  default   = null
  nullable  = true
  sensitive = true
}

variable "tags" {
  type = map(string)
}

locals {
  service_names = toset(["server", "litellm", "temporal", "agentgateway", "opa"])
  other_environments = toset([
    for environment in ["dev", "staging", "prod"] : environment
    if environment != var.environment
  ])
  ecs_assume_role = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  service_ecr_repository_arns = {
    for service in local.service_names : service => lookup(var.service_ecr_repository_arns, service, toset([]))
  }
  service_secret_names = {
    for service in local.service_names : service => lookup(var.service_secret_names, service, toset([]))
  }
  service_secret_arns = {
    for service, names in local.service_secret_names : service => [
      for name in names : "arn:${data.aws_partition.current.partition}:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:${name}-??????"
    ]
  }
  denied_environment_resources = flatten([
    for environment in local.other_environments : [
      "arn:${data.aws_partition.current.partition}:iam::${data.aws_caller_identity.current.account_id}:role/aiops-${environment}-*",
      "arn:${data.aws_partition.current.partition}:secretsmanager:*:${data.aws_caller_identity.current.account_id}:secret:aiops-${environment}/*",
      "arn:${data.aws_partition.current.partition}:ecr:*:${data.aws_caller_identity.current.account_id}:repository/aiops-${environment}/*",
      "arn:${data.aws_partition.current.partition}:ecs:*:${data.aws_caller_identity.current.account_id}:cluster/aiops-${environment}*",
      "arn:${data.aws_partition.current.partition}:ecs:*:${data.aws_caller_identity.current.account_id}:service/aiops-${environment}*"
    ]
  ])
}

data "aws_partition" "current" {}
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = var.github_oidc_thumbprints
  tags            = merge(var.tags, { Name = "${var.name}-github-oidc" })
}

resource "aws_iam_role" "ecs_execution" {
  name               = "${var.name}-ecs-execution"
  assume_role_policy = local.ecs_assume_role
  tags               = var.tags
}

resource "aws_iam_role_policy" "ecs_execution" {
  name = "${var.name}-ecs-execution"
  role = aws_iam_role.ecs_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "EcrAuthorization"
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Sid      = "PullPinnedImages"
        Effect   = "Allow"
        Action   = ["ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage"]
        Resource = var.ecr_repository_arns
      },
      {
        Sid      = "WriteServiceLogs"
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:log-group:/aiops/${var.name}/*:log-stream:*"
      },
      {
        Sid      = "ReadDeclaredSecrets"
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = var.secret_arns
      }
    ]
  })
}

resource "aws_iam_role" "ecs_task" {
  name               = "${var.name}-ecs-task"
  assume_role_policy = local.ecs_assume_role
  tags               = var.tags
}

resource "aws_iam_role" "service_execution" {
  for_each           = local.service_names
  name               = "${var.name}-${each.key}-execution"
  assume_role_policy = local.ecs_assume_role
  tags               = merge(var.tags, { Environment = var.environment, Service = each.key })
}

resource "aws_iam_role_policy" "service_execution" {
  for_each = local.service_names
  name     = "${var.name}-${each.key}-execution"
  role     = aws_iam_role.service_execution[each.key].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        {
          Sid      = "EcrAuthorization"
          Effect   = "Allow"
          Action   = ["ecr:GetAuthorizationToken"]
          Resource = "*"
        },
        {
          Sid      = "WriteServiceLogs"
          Effect   = "Allow"
          Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
          Resource = "arn:${data.aws_partition.current.partition}:logs:*:${data.aws_caller_identity.current.account_id}:log-group:/aiops/${var.name}/${each.key}:log-stream:*"
        },
        {
          Sid      = "DenyLongLivedCredentials"
          Effect   = "Deny"
          Action   = ["iam:CreateAccessKey", "iam:UpdateAccessKey", "iam:CreateLoginProfile"]
          Resource = "*"
        },
        {
          Sid      = "DenyRoleChaining"
          Effect   = "Deny"
          Action   = ["sts:AssumeRole", "iam:PassRole"]
          Resource = "*"
        }
      ],
      [for statement in [{
        Sid      = "PullServiceImage"
        Effect   = "Allow"
        Action   = ["ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage"]
        Resource = local.service_ecr_repository_arns[each.key]
      }] : statement if length(local.service_ecr_repository_arns[each.key]) > 0],
      [for statement in [
        {
          Sid      = "ReadServiceSecrets"
          Effect   = "Allow"
          Action   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
          Resource = local.service_secret_arns[each.key]
        },
        {
          Sid       = "DecryptServiceSecrets"
          Effect    = "Allow"
          Action    = ["kms:Decrypt", "kms:DescribeKey"]
          Resource  = var.secrets_kms_key_arn
          Condition = { StringEquals = { "kms:ViaService" = "secretsmanager.${data.aws_region.current.name}.amazonaws.com" } }
        }
      ] : statement if length(local.service_secret_arns[each.key]) > 0]
    )
  })

  lifecycle {
    precondition {
      condition     = length(local.service_secret_arns[each.key]) == 0 || var.secrets_kms_key_arn != null
      error_message = "service secret access requires secrets_kms_key_arn."
    }
    precondition {
      condition     = alltrue([for name in local.service_secret_names[each.key] : startswith(name, "${var.name}/")])
      error_message = "service secrets must remain under the environment name prefix."
    }
  }
}

resource "aws_iam_role" "service_task" {
  for_each             = local.service_names
  name                 = "${var.name}-${each.key}-task"
  assume_role_policy   = local.ecs_assume_role
  max_session_duration = 3600
  tags                 = merge(var.tags, { Environment = var.environment, Service = each.key })
}

resource "aws_iam_role_policy" "service_task" {
  for_each = local.service_names
  name     = "${var.name}-${each.key}-task"
  role     = aws_iam_role.service_task[each.key].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        {
          Sid      = "DenyLongLivedCredentials"
          Effect   = "Deny"
          Action   = ["iam:CreateAccessKey", "iam:UpdateAccessKey", "iam:CreateLoginProfile"]
          Resource = "*"
        },
        {
          Sid      = "DenyRoleChaining"
          Effect   = "Deny"
          Action   = ["sts:AssumeRole", "iam:PassRole"]
          Resource = "*"
        }
      ],
      [for statement in [
        {
          Sid      = "ReadServiceSecrets"
          Effect   = "Allow"
          Action   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
          Resource = local.service_secret_arns[each.key]
        },
        {
          Sid       = "DecryptServiceSecrets"
          Effect    = "Allow"
          Action    = ["kms:Decrypt", "kms:DescribeKey"]
          Resource  = var.secrets_kms_key_arn
          Condition = { StringEquals = { "kms:ViaService" = "secretsmanager.${data.aws_region.current.name}.amazonaws.com" } }
        }
      ] : statement if length(local.service_secret_arns[each.key]) > 0],
      [for statement in [{
        Sid      = "InvokeDeclaredBedrockModels"
        Effect   = "Allow"
        Action   = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"]
        Resource = var.bedrock_model_arns
      }] : statement if each.key == "litellm" && length(var.bedrock_model_arns) > 0]
    )
  })

  lifecycle {
    precondition {
      condition     = length(local.service_secret_arns[each.key]) == 0 || var.secrets_kms_key_arn != null
      error_message = "service secret access requires secrets_kms_key_arn."
    }
    precondition {
      condition     = alltrue([for name in local.service_secret_names[each.key] : startswith(name, "${var.name}/")])
      error_message = "service secrets must remain under the environment name prefix."
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name = "${var.name}-github-deploy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:environment:${var.environment}"
        }
      }
    }]
  })
  max_session_duration = 3600
  tags                 = merge(var.tags, { Environment = var.environment })
}

resource "aws_iam_role_policy" "github_guardrails" {
  name = "${var.name}-github-guardrails"
  role = aws_iam_role.github_deploy.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "DenyLongLivedCredentials"
        Effect   = "Deny"
        Action   = ["iam:CreateAccessKey", "iam:UpdateAccessKey", "iam:CreateLoginProfile", "iam:CreateUser"]
        Resource = "*"
      },
      {
        Sid      = "DenyRoleChaining"
        Effect   = "Deny"
        Action   = ["sts:AssumeRole", "sts:AssumeRoleWithSAML"]
        Resource = "*"
      },
      {
        Sid      = "DenyCrossEnvironmentSecrets"
        Effect   = "Deny"
        Action   = ["secretsmanager:*"]
        Resource = local.denied_environment_resources
      },
      {
        Sid      = "DenyCrossEnvironmentKms"
        Effect   = "Deny"
        Action   = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey*"]
        Resource = "*"
        Condition = {
          StringNotEquals = { "aws:ResourceTag/Environment" = var.environment }
        }
      },
      {
        Sid      = "DenyKmsTagMutation"
        Effect   = "Deny"
        Action   = ["kms:TagResource", "kms:UntagResource"]
        Resource = "*"
      },
      {
        Sid      = "DenyCrossEnvironmentDeploy"
        Effect   = "Deny"
        Action   = ["iam:PassRole", "ecs:*", "ecr:*"]
        Resource = local.denied_environment_resources
      }
    ]
  })
}

resource "aws_iam_role_policy" "github_deploy" {
  count  = var.github_deployment_policy_json == null ? 0 : 1
  name   = "${var.name}-github-deploy"
  role   = aws_iam_role.github_deploy.id
  policy = var.github_deployment_policy_json
}

output "ecs_execution_role_arn" {
  value = aws_iam_role.ecs_execution.arn
}

output "ecs_task_role_arn" {
  value = aws_iam_role.ecs_task.arn
}

output "github_deploy_role_arn" {
  value = aws_iam_role.github_deploy.arn
}

output "service_execution_role_arns" {
  value = { for service, role in aws_iam_role.service_execution : service => role.arn }
}

output "service_task_role_arns" {
  value = { for service, role in aws_iam_role.service_task : service => role.arn }
}
