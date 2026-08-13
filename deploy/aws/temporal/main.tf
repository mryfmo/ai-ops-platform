# 根拠: FinalArch:TMP-001 / ADR-0021 / ADR-0029 / ENV-DEC-001（案 B'、P3-T01）
# Temporal OSS 単一レプリカ（ECS Fargate、private subnet、gRPC 7233 は VPC 内部のみ）。
# VPC / ECS cluster / RDS instance 本体は P10-T01 の AWS baseline が所有し、
# 本モジュールは変数で参照する（Console 手作業は構成ドリフトとして不受理 — ENV-DEC-001）。
# apply は AWS 環境 / ENV gate 整備後（現段階は validate/fmt + lock file が検証範囲）。
#
# TLS/認可資材は Secrets Manager から ECS secrets として *_DATA 系 env に注入する
# （config template が PEM 内容 env を native サポート — ファイル展開 sidecar 不要）。
# JWKS は同一タスク内 sidecar（httpd）が配信し、frontend は localhost で参照する。

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
  # smoke（deploy/temporal/smoke.sh）で実証済みの TLS/認可 env 一式と同形にする
  temporal_static_env = [
    { name = "DB", value = "postgres12" },
    { name = "DB_PORT", value = tostring(var.db_port) },
    { name = "POSTGRES_SEEDS", value = var.db_host },
    { name = "POSTGRES_USER", value = var.db_user },
    { name = "DBNAME", value = "temporal" },
    { name = "VISIBILITY_DBNAME", value = "temporal_visibility" },
    # authorizer 有効時は namespace 初期化を operator identity で行う（RUNBOOK）
    { name = "SKIP_DEFAULT_NAMESPACE_CREATION", value = "true" },
    { name = "SKIP_ADD_CUSTOM_SEARCH_ATTRIBUTES", value = "true" },
    { name = "USE_INTERNAL_FRONTEND", value = "true" },
    { name = "SERVICES", value = "frontend,internal-frontend,history,matching,worker" },
    { name = "TEMPORAL_AUTH_AUTHORIZER", value = "default" },
    { name = "TEMPORAL_AUTH_CLAIM_MAPPER", value = "default" },
    { name = "TEMPORAL_JWT_KEY_SOURCE1", value = "http://127.0.0.1:8080/jwks.json" },
    { name = "TEMPORAL_TLS_REQUIRE_CLIENT_AUTH", value = "true" },
    { name = "TEMPORAL_TLS_FRONTEND_SERVER_NAME", value = "aiops-temporal-frontend.${var.environment}" },
    { name = "TEMPORAL_TLS_INTERNODE_SERVER_NAME", value = "aiops-temporal-frontend.${var.environment}" },
    { name = "TEMPORAL_TLS_INTERNODE_DISABLE_HOST_VERIFICATION", value = "false" },
    { name = "TEMPORAL_TLS_FRONTEND_DISABLE_HOST_VERIFICATION", value = "false" },
  ]
  # PEM 内容を Secrets Manager から直接 env 注入（config template の *_DATA 系）
  temporal_tls_secret_env = {
    TEMPORAL_TLS_SERVER_CA_CERT_DATA  = aws_secretsmanager_secret.tls["ca"].arn
    TEMPORAL_TLS_SERVER_CERT_DATA     = aws_secretsmanager_secret.tls["server-cert"].arn
    TEMPORAL_TLS_SERVER_KEY_DATA      = aws_secretsmanager_secret.tls["server-key"].arn
    TEMPORAL_TLS_FRONTEND_CERT_DATA   = aws_secretsmanager_secret.tls["server-cert"].arn
    TEMPORAL_TLS_FRONTEND_KEY_DATA    = aws_secretsmanager_secret.tls["server-key"].arn
    TEMPORAL_TLS_CLIENT1_CA_CERT_DATA = aws_secretsmanager_secret.tls["ca"].arn
  }
}

# ---------------------------------------------------------------------------
# mTLS / 認可資材（ENV-DEC-001: Secrets Manager 管理。値の投入は RUNBOOK の
# rotation 手順で行い、tf state に秘密値を置かない）
# ---------------------------------------------------------------------------
resource "aws_secretsmanager_secret" "tls" {
  for_each = toset([
    "ca", "server-cert", "server-key",
    "worker-cert", "worker-key",
    "operator-cert", "operator-key",
  ])
  name        = "${local.name}/tls/${each.key}"
  description = "Temporal mTLS material (${each.key}) for ${var.environment} (ENV-DEC-001)"
}

resource "aws_secretsmanager_secret" "authz" {
  for_each    = toset(["jwt-signing-key", "jwks"])
  name        = "${local.name}/authz/${each.key}"
  description = "Temporal internal JWT authorization material (${each.key}) for ${var.environment}"
}

resource "aws_secretsmanager_secret" "db_password" {
  name        = "${local.name}/db-password"
  description = "Temporal PostgreSQL password for ${var.environment}"
}

# ---------------------------------------------------------------------------
# ネットワーク: gRPC 7233 は worker SG からのみ。egress は RDS と VPC endpoints に限定
# （追加統制。同一性統制は mTLS + 内部 JWT — ENV-DEC-001 / Owner 裁定 2026-08-13）
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
    description     = "PostgreSQL to RDS security group only"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.rds_security_group_id]
  }

  egress {
    description     = "HTTPS to VPC endpoints (Secrets Manager / ECR / CloudWatch)"
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [var.vpc_endpoints_security_group_id]
  }
}

# VPC endpoints 側の受け入れ（egress 相当の ingress を両方向で確立 — P3-T01-008）
resource "aws_vpc_security_group_ingress_rule" "endpoints_from_temporal" {
  security_group_id            = var.vpc_endpoints_security_group_id
  referenced_security_group_id = aws_security_group.temporal.id
  from_port                    = 443
  to_port                      = 443
  ip_protocol                  = "tcp"
  description                  = "Temporal task to VPC endpoints (Secrets Manager / ECR / CloudWatch)"
}

# RDS 側の受け入れ（baseline の RDS SG へ本モジュールが片方向で穴を開ける）
resource "aws_vpc_security_group_ingress_rule" "rds_from_temporal" {
  security_group_id            = var.rds_security_group_id
  referenced_security_group_id = aws_security_group.temporal.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  description                  = "Temporal server to RDS (temporal / temporal_visibility)"
}

resource "aws_cloudwatch_log_group" "temporal" {
  name              = "/aiops/${var.environment}/temporal"
  retention_in_days = 30
}

# ---------------------------------------------------------------------------
# 安定エンドポイント: Cloud Map private DNS（workers は
# temporal.<environment>.aiops.internal:7233 へ接続し、TLS 検証は
# serverNameOverride=aiops-temporal-frontend.<env> — control-plane factory が設定）
# ---------------------------------------------------------------------------
resource "aws_service_discovery_private_dns_namespace" "temporal" {
  name        = "${var.environment}.aiops.internal"
  description = "aiops private service discovery (${var.environment})"
  vpc         = var.vpc_id
}

resource "aws_service_discovery_service" "temporal" {
  name = "temporal"
  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.temporal.id
    dns_records {
      ttl  = 10
      type = "A"
    }
    routing_policy = "MULTIVALUE"
  }
  health_check_custom_config {
    failure_threshold = 1
  }
}

# ---------------------------------------------------------------------------
# ECS Fargate 単一タスクサービス（単一レプリカ運用 — ENV-DEC-001 の測定ゲート準拠。
# deployment は replace（min 0 / max 100）で二重稼働を避ける）
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
      environment  = local.temporal_static_env
      secrets = concat(
        [{ name = "POSTGRES_PWD", valueFrom = aws_secretsmanager_secret.db_password.arn }],
        [for name, arn in local.temporal_tls_secret_env : { name = name, valueFrom = arn }],
      )
      dependsOn = [{ containerName = "jwks", condition = "START" }]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.temporal.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "temporal"
        }
      }
    },
    {
      # 内部 JWT の JWKS を同一タスク内で配信（localhost:8080）。公開面なし
      name         = "jwks"
      image        = var.jwks_sidecar_image
      essential    = true
      portMappings = [{ containerPort = 8080, protocol = "tcp" }]
      secrets      = [{ name = "JWKS_JSON", valueFrom = aws_secretsmanager_secret.authz["jwks"].arn }]
      entryPoint   = ["/bin/sh", "-c"]
      command = [
        "mkdir -p /www && printf '%s' \"$JWKS_JSON\" > /www/jwks.json && exec httpd -f -p 8080 -h /www"
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.temporal.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "jwks"
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

  service_registries {
    registry_arn = aws_service_discovery_service.temporal.arn
  }
}

output "temporal_endpoint" {
  description = "workers が接続する安定エンドポイント（host:port）"
  value       = "temporal.${var.environment}.aiops.internal:7233"
}

output "temporal_security_group_id" {
  value = aws_security_group.temporal.id
}
