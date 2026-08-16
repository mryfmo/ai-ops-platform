# 根拠: FinalArch:PRD-010 / FinalArch:FR-CP-008 / FinalArch:FR-OBS-005 / ADR-0029 / REL-001 / P10-T01
terraform {
  required_version = ">= 1.7.0, < 2.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 5.100.0"
    }
  }

}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = local.tags
  }
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  default_tags {
    tags = local.tags
  }
}

provider "aws" {
  alias  = "dr"
  region = "ap-northeast-3"
  default_tags {
    tags = local.tags
  }
}

variable "environment" {
  type = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod."
  }
}

variable "aws_region" {
  type    = string
  default = "ap-northeast-1"
}

variable "vpc_cidr" {
  type = string
}

variable "availability_zones" {
  type = list(string)
}

variable "public_subnet_cidrs" {
  type = list(string)
}

variable "private_subnet_cidrs" {
  type = list(string)
}

variable "cloudfront_origin_prefix_list_id" {
  type = string
}

variable "alb_certificate_arn" {
  type = string
}

variable "alb_origin_domain_name" {
  type = string
}

variable "cloudfront_cache_policy_id" {
  type = string
}

variable "cloudfront_aliases" {
  type    = list(string)
  default = []
}

variable "cloudfront_certificate_arn" {
  type     = string
  default  = null
  nullable = true
}

variable "github_repository" {
  type = string
}

variable "github_oidc_thumbprints" {
  type = list(string)
}

variable "secret_names" {
  type = set(string)
}

variable "services" {
  type = map(object({
    repository    = string
    image         = string
    cpu           = number
    memory        = number
    port          = number
    desired_count = number
    health_path   = string
    path_patterns = list(string)
    environment   = map(string)
    secret_names  = map(string)
  }))
}

variable "rds_instance_class" {
  type = string
}

variable "rds_allocated_storage_gib" {
  type = number
}

variable "tags" {
  type    = map(string)
  default = {}
}

locals {
  name = "aiops-${var.environment}"
  tags = merge(var.tags, {
    Environment = var.environment
    ManagedBy   = "terraform"
    Project     = "ai-ops-platform"
  })
  repository_names = toset([for service in values(var.services) : "${local.name}/${service.repository}"])
  database_secret_names = toset([
    "database/app-password",
    "database/litellm-password",
  ])
  secret_names = toset([
    for secret_name in setunion(var.secret_names, local.database_secret_names) : "${local.name}/${secret_name}"
  ])
}

resource "aws_backup_vault" "rds_long_term_dr" {
  provider = aws.dr
  count    = var.environment == "prod" ? 1 : 0
  name     = "${local.name}-postgres-long-term-dr"
  tags     = merge(local.tags, { Name = "${local.name}-postgres-long-term-dr" })
}

resource "aws_kms_key" "rds_dr_backup" {
  provider                = aws.dr
  count                   = var.environment == "prod" ? 1 : 0
  description             = "Cross-region RDS automated backups for ${local.name}"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  tags                    = merge(local.tags, { Name = "${local.name}-rds-dr-backup" })
}

resource "aws_kms_alias" "rds_dr_backup" {
  provider      = aws.dr
  count         = var.environment == "prod" ? 1 : 0
  name          = "alias/${local.name}-rds-dr-backup"
  target_key_id = aws_kms_key.rds_dr_backup[0].key_id
}

module "network" {
  source               = "../modules/network"
  name                 = local.name
  vpc_cidr             = var.vpc_cidr
  availability_zones   = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  tags                 = local.tags
}

module "ecr" {
  source = "../modules/ecr"
  names  = local.repository_names
  tags   = local.tags
}

module "secrets_manager" {
  source = "../modules/secrets-manager"
  names  = local.secret_names
  tags   = local.tags
}

module "identity" {
  source                  = "../modules/identity"
  name                    = local.name
  environment             = var.environment
  github_repository       = var.github_repository
  github_oidc_thumbprints = var.github_oidc_thumbprints
  ecr_repository_arns     = values(module.ecr.repository_arns)
  secret_arns = [
    for secret_name in var.secret_names :
    module.secrets_manager.secret_arns["${local.name}/${secret_name}"]
  ]
  github_deployment_policy_json = null
  tags                          = local.tags
}

module "alb" {
  source                           = "../modules/alb"
  name                             = "${local.name}-alb"
  environment                      = var.environment
  vpc_id                           = module.network.vpc_id
  vpc_cidr                         = module.network.vpc_cidr
  public_subnet_ids                = module.network.public_subnet_ids
  cloudfront_origin_prefix_list_id = var.cloudfront_origin_prefix_list_id
  certificate_arn                  = var.alb_certificate_arn
  target_groups = {
    for name, service in var.services : name => {
      port          = service.port
      health_path   = service.health_path
      path_patterns = service.path_patterns
    }
  }
  tags = local.tags
}

module "ecs_fargate" {
  source                = "../modules/ecs-fargate"
  name                  = local.name
  aws_region            = var.aws_region
  vpc_id                = module.network.vpc_id
  private_subnet_ids    = module.network.private_subnet_ids
  alb_security_group_id = module.alb.security_group_id
  execution_role_arn    = module.identity.ecs_execution_role_arn
  task_role_arn         = module.identity.ecs_task_role_arn
  target_group_arns     = module.alb.target_group_arns
  services = {
    for name, service in var.services : name => {
      image         = service.image
      cpu           = service.cpu
      memory        = service.memory
      port          = service.port
      desired_count = service.desired_count
      environment   = service.environment
      secrets = {
        for environment_name, secret_name in service.secret_names :
        environment_name => module.secrets_manager.secret_arns["${local.name}/${secret_name}"]
      }
    }
  }
  tags = local.tags
}

module "rds" {
  source                     = "../modules/rds"
  name                       = "${local.name}-postgres"
  environment                = var.environment
  vpc_id                     = module.network.vpc_id
  private_subnet_ids         = module.network.private_subnet_ids
  allowed_security_group_ids = { ecs = module.ecs_fargate.service_security_group_id }
  instance_class             = var.rds_instance_class
  allocated_storage_gib      = var.rds_allocated_storage_gib
  enable_long_term_copy      = var.environment == "prod"
  long_term_copy_vault_arn   = try(aws_backup_vault.rds_long_term_dr[0].arn, null)
  tags                       = local.tags
}

resource "aws_db_instance_automated_backups_replication" "rds_dr" {
  provider               = aws.dr
  count                  = var.environment == "prod" ? 1 : 0
  source_db_instance_arn = module.rds.database_arn
  retention_period       = 35
  kms_key_id             = aws_kms_key.rds_dr_backup[0].arn
}

module "waf" {
  source = "../modules/waf"
  providers = {
    aws = aws.us_east_1
  }
  name = "${local.name}-cloudfront"
  tags = local.tags
}

module "cloudfront" {
  source                     = "../modules/cloudfront"
  origin_domain_name         = var.alb_origin_domain_name
  web_acl_arn                = module.waf.arn
  name                       = "${local.name}-edge"
  cache_policy_id            = var.cloudfront_cache_policy_id
  aliases                    = var.cloudfront_aliases
  acm_certificate_arn        = var.cloudfront_certificate_arn
  require_custom_certificate = var.environment != "dev"
  tags                       = local.tags
}

output "cloudfront_domain_name" {
  value = module.cloudfront.domain_name
}

output "alb_dns_name" {
  description = "Create the reviewed origin DNS record outside this stack against this value."
  value       = module.alb.dns_name
}

output "ecs_cluster_arn" {
  value = module.ecs_fargate.cluster_arn
}

output "database_secret_arns" {
  description = "Secret containers populated by the approved environment bootstrap; Terraform creates no values."
  value = {
    for name in local.database_secret_names :
    name => module.secrets_manager.secret_arns["${local.name}/${name}"]
  }
  sensitive = true
}

output "rds_long_term_dr_backup_vault_arn" {
  value = try(aws_backup_vault.rds_long_term_dr[0].arn, null)
}

output "rds_dr_automated_backup_arn" {
  value = try(aws_db_instance_automated_backups_replication.rds_dr[0].id, null)
}

output "ecr_repository_urls" {
  value = module.ecr.repository_urls
}

output "rds_endpoint" {
  value     = module.rds.endpoint
  sensitive = true
}

output "github_deploy_role_arn" {
  value = module.identity.github_deploy_role_arn
}
