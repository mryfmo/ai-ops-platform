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
  validation {
    # ADR-0029: 本番 image は ECR ミラー + immutable digest（任意レジストリは endpoint
    # 限定 egress で到達不能でもある）
    condition     = can(regex("^[0-9]{12}\\.dkr\\.ecr\\.[a-z0-9-]+\\.amazonaws\\.com/.+@sha256:[0-9a-f]{64}$", var.temporal_image))
    error_message = "temporal_image must be an ECR-mirrored reference pinned by immutable digest."
  }
}

variable "jwks_sidecar_image" {
  type        = string
  description = "JWKS 配信 sidecar image（busybox 系 httpd。immutable digest で pin）"
  validation {
    condition     = can(regex("^[0-9]{12}\\.dkr\\.ecr\\.[a-z0-9-]+\\.amazonaws\\.com/.+@sha256:[0-9a-f]{64}$", var.jwks_sidecar_image))
    error_message = "jwks_sidecar_image must be an ECR-mirrored reference pinned by immutable digest."
  }
}

variable "rds_security_group_id" {
  type        = string
  description = "baseline RDS の security group（5432 の相互穴あけ対象）"
}

variable "vpc_endpoints_security_group_id" {
  type        = string
  description = "Secrets Manager / ECR / CloudWatch VPC endpoint 群の security group"
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
