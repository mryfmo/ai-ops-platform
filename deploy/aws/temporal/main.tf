# 根拠: FinalArch:TMP-001 / ADR-0021 / ADR-0029 / ENV-DEC-001（案 B'、P3-T01）
# Temporal OSS 単一レプリカ（ECS Fargate、private subnet、gRPC 7233 は VPC 内部のみ）。
# VPC / ECS cluster / RDS instance 本体は P10-T01 の AWS baseline が所有し、
# 本モジュールは変数で参照する（Console 手作業は構成ドリフトとして不受理 — ENV-DEC-001）。
# apply は AWS 環境 / ENV gate 整備後（現段階は validate/fmt までが検証範囲）。

terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }
}

locals {
  name      = "aiops-temporal-${var.environment}"
  namespace = "aiops-${var.environment}"
}

# ---------------------------------------------------------------------------
# mTLS 資材（ENV-DEC-001: CA / server / worker / operator を Secrets Manager 管理。
# 値の投入は運用 rotation 手順（deploy/temporal/RUNBOOK.md）で行い、tf には置かない）
# ---------------------------------------------------------------------------
resource "aws_secretsmanager_secret" "tls" {
  for_each    = toset(["ca", "server-cert", "server-key", "worker-cert", "worker-key", "operator-cert", "operator-key"])
  name        = "${local.name}/tls/${each.key}"
  description = "Temporal mTLS material (${each.key}) for ${var.environment} (ENV-DEC-001)"
}

resource "aws_secretsmanager_secret" "db_password" {
  name        = "${local.name}/db-password"
  description = "Temporal PostgreSQL password for ${var.environment}"
}

# ---------------------------------------------------------------------------
# ネットワーク: gRPC 7233 は worker SG からのみ。外部公開なし（追加統制。
# 同一性統制は mTLS — ENV-DEC-001）
# ---------------------------------------------------------------------------
resource "aws_security_group" "temporal" {
  name        = local.name
  description = "Temporal frontend (internal gRPC only)"
  vpc_id      = var.vpc_id

  ingress {
    description     = "gRPC from platform workers only"
    from_port       = 7233
    to_port         = 7233
    protocol        = "tcp"
    security_groups = [var.worker_security_group_id]
  }

  egress {
    description = "RDS and AWS APIs"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_cloudwatch_log_group" "temporal" {
  name              = "/aiops/${var.environment}/temporal"
  retention_in_days = 30
}

# ---------------------------------------------------------------------------
# ECS Fargate 単一タスクサービス（単一レプリカ運用 — 信頼性受入は ENV-DEC-001 の
# 測定ゲートに従う。deployment は replace（min 0 / max 100）で二重稼働を避ける）
# ---------------------------------------------------------------------------
resource "aws_ecs_task_definition" "temporal" {
  family                   = local.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name         = "temporal"
      image        = var.temporal_image
      essential    = true
      portMappings = [{ containerPort = 7233, protocol = "tcp" }]
      environment = [
        { name = "DB", value = "postgres12" },
        { name = "DB_PORT", value = tostring(var.db_port) },
        { name = "POSTGRES_SEEDS", value = var.db_host },
        { name = "POSTGRES_USER", value = var.db_user },
        { name = "DBNAME", value = "temporal" },
        { name = "VISIBILITY_DBNAME", value = "temporal_visibility" },
        { name = "DEFAULT_NAMESPACE", value = local.namespace },
        { name = "TEMPORAL_TLS_REQUIRE_CLIENT_AUTH", value = "true" },
        { name = "TEMPORAL_TLS_SERVER_CA_CERT", value = "/etc/temporal/certs/ca.crt" },
        { name = "TEMPORAL_TLS_SERVER_CERT", value = "/etc/temporal/certs/server.crt" },
        { name = "TEMPORAL_TLS_SERVER_KEY", value = "/etc/temporal/certs/server.key" },
        { name = "TEMPORAL_TLS_FRONTEND_SERVER_NAME", value = "aiops-temporal-frontend.${var.environment}" },
      ]
      secrets = [
        { name = "POSTGRES_PWD", valueFrom = aws_secretsmanager_secret.db_password.arn },
      ]
      # 証明書ファイルは entrypoint 前段で Secrets Manager から /etc/temporal/certs へ
      # 展開する（sidecar/init の詳細は P10 帯の baseline 統合時に確定。RUNBOOK 参照）
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.temporal.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "temporal"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "temporal" {
  name                               = local.name
  cluster                            = var.ecs_cluster_arn
  task_definition                    = aws_ecs_task_definition.temporal.arn
  desired_count                      = 1
  launch_type                        = "FARGATE"
  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.temporal.id]
    assign_public_ip = false
  }
}
