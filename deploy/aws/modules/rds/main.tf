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

variable "tags" {
  type = map(string)
}

resource "aws_db_subnet_group" "this" {
  name       = var.name
  subnet_ids = var.private_subnet_ids
  tags       = merge(var.tags, { Name = var.name })
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
