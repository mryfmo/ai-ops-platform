# 根拠: FinalArch:PRD-010 / ADR-0029 / REL-001 / P10-T01
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
  ecs_assume_role = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

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
  tags = var.tags
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
