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

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "RDS requires at least two private subnets."
  }
}

variable "allowed_security_group_ids" {
  type = map(string)
}

variable "database_name" {
  type    = string
  default = "aiops"
}

variable "master_username" {
  type    = string
  default = "aiops_admin"
}

variable "engine_version" {
  type    = string
  default = "16.4"
}

locals {
  engine_major = split(".", var.engine_version)[0]
}

variable "instance_class" {
  type = string
}

variable "allocated_storage_gib" {
  type = number
  validation {
    condition     = var.allocated_storage_gib >= 20
    error_message = "allocated_storage_gib must be at least 20."
  }
}

variable "enable_long_term_copy" {
  type    = bool
  default = false
}

variable "long_term_copy_vault_arn" {
  type     = string
  default  = null
  nullable = true
}

variable "tags" {
  type = map(string)
}

resource "aws_db_subnet_group" "this" {
  name       = var.name
  subnet_ids = var.private_subnet_ids
  tags       = merge(var.tags, { Name = var.name })
}

resource "aws_db_parameter_group" "this" {
  name   = "${var.name}-postgres${local.engine_major}"
  family = "postgres${local.engine_major}"

  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "pending-reboot"
  }

  tags = merge(var.tags, { Name = "${var.name}-postgres${local.engine_major}" })
}

resource "aws_security_group" "this" {
  name        = "${var.name}-rds"
  description = "PostgreSQL from declared internal service security groups only"
  vpc_id      = var.vpc_id
  egress      = []
  tags        = merge(var.tags, { Name = "${var.name}-rds" })
}

resource "aws_vpc_security_group_ingress_rule" "postgres" {
  for_each                     = var.allowed_security_group_ids
  security_group_id            = aws_security_group.this.id
  referenced_security_group_id = each.value
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  description                  = "PostgreSQL from an approved internal service"
}

resource "aws_db_instance" "this" {
  identifier                            = var.name
  engine                                = "postgres"
  engine_version                        = var.engine_version
  instance_class                        = var.instance_class
  allocated_storage                     = var.allocated_storage_gib
  max_allocated_storage                 = var.allocated_storage_gib * 4
  storage_type                          = "gp3"
  storage_encrypted                     = true
  db_name                               = var.database_name
  username                              = var.master_username
  manage_master_user_password           = true
  iam_database_authentication_enabled   = true
  parameter_group_name                  = aws_db_parameter_group.this.name
  db_subnet_group_name                  = aws_db_subnet_group.this.name
  vpc_security_group_ids                = [aws_security_group.this.id]
  publicly_accessible                   = false
  multi_az                              = var.environment == "prod"
  backup_retention_period               = 35
  enabled_cloudwatch_logs_exports       = ["postgresql", "upgrade"]
  performance_insights_enabled          = true
  performance_insights_retention_period = var.environment == "prod" ? 731 : 7
  copy_tags_to_snapshot                 = true
  deletion_protection                   = var.environment == "prod"
  skip_final_snapshot                   = var.environment != "prod"
  final_snapshot_identifier             = "${var.name}-final"
  auto_minor_version_upgrade            = true
  apply_immediately                     = false
  tags                                  = merge(var.tags, { Name = var.name })
}

resource "aws_backup_vault" "long_term" {
  name = "${var.name}-long-term"
  tags = merge(var.tags, { Name = "${var.name}-long-term" })
}

resource "aws_iam_role" "backup" {
  name = "${var.name}-backup"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "backup.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = merge(var.tags, { Name = "${var.name}-backup" })
}

resource "aws_iam_role_policy_attachment" "backup" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}

resource "aws_backup_plan" "long_term" {
  name = "${var.name}-long-term"

  rule {
    rule_name         = "daily-rds-long-term"
    target_vault_name = aws_backup_vault.long_term.name
    schedule          = "cron(0 18 * * ? *)"

    lifecycle {
      delete_after = 35
    }

    dynamic "copy_action" {
      for_each = var.enable_long_term_copy ? [true] : []
      content {
        destination_vault_arn = var.long_term_copy_vault_arn
        lifecycle {
          delete_after = 35
        }
      }
    }
  }

  tags = merge(var.tags, { Name = "${var.name}-long-term" })

  lifecycle {
    precondition {
      condition     = !var.enable_long_term_copy || var.long_term_copy_vault_arn != null
      error_message = "long-term copy requires a destination backup vault ARN."
    }
  }
}

resource "aws_backup_selection" "rds" {
  name         = "${var.name}-rds"
  iam_role_arn = aws_iam_role.backup.arn
  plan_id      = aws_backup_plan.long_term.id
  resources    = [aws_db_instance.this.arn]
}

output "endpoint" {
  value = aws_db_instance.this.endpoint
}

output "security_group_id" {
  value = aws_security_group.this.id
}

output "master_secret_arn" {
  value     = try(aws_db_instance.this.master_user_secret[0].secret_arn, null)
  sensitive = true
}

output "database_arn" {
  value = aws_db_instance.this.arn
}

output "parameter_group_name" {
  value = aws_db_parameter_group.this.name
}

output "long_term_backup_vault_arn" {
  value = aws_backup_vault.long_term.arn
}
