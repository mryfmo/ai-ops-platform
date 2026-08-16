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

variable "tags" {
  type = map(string)
}

resource "aws_secretsmanager_secret" "this" {
  for_each                = var.names
  name                    = each.key
  description             = "Value is injected by the environment bootstrap; Terraform creates no secret version."
  recovery_window_in_days = var.recovery_window_in_days
  tags                    = merge(var.tags, { Name = each.key })
}

output "secret_arns" {
  value = { for name, secret in aws_secretsmanager_secret.this : name => secret.arn }
}
