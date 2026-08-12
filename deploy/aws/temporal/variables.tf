# 根拠: FinalArch:TMP-001 / ADR-0029 / ENV-DEC-001（P3-T01）
variable "environment" {
  type        = string
  description = "dev | staging | prod（namespace = aiops-<env>）"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod."
  }
}

variable "aws_region" {
  type        = string
  description = "ADR-0029 primary は ap-northeast-1"
  default     = "ap-northeast-1"
}

variable "vpc_id" {
  type        = string
  description = "P10-T01 baseline の VPC"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "private subnet（外部公開なし）"
}

variable "ecs_cluster_arn" {
  type        = string
  description = "P10-T01 baseline の ECS cluster"
}

variable "worker_security_group_id" {
  type        = string
  description = "gRPC 7233 の唯一の許可元（platform worker SG）"
}

variable "execution_role_arn" {
  type = string
}

variable "task_role_arn" {
  type = string
}

variable "temporal_image" {
  type        = string
  description = "Temporal server image（immutable digest で pin。ADR-0029）"
}

variable "db_host" {
  type        = string
  description = "RDS endpoint（temporal / temporal_visibility DB を追加 — ENV-DEC-001）"
}

variable "db_port" {
  type    = number
  default = 5432
}

variable "db_user" {
  type    = string
  default = "temporal"
}

variable "task_cpu" {
  type    = string
  default = "512"
}

variable "task_memory" {
  type    = string
  default = "2048"
}
