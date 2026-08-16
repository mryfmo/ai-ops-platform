# 根拠: FinalArch:PRD-010 / FinalArch:FR-OBS-005 / ADR-0029 / REL-001 / P10-T01
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

variable "aws_region" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "ECS requires at least two private subnets."
  }
}

variable "alb_security_group_id" {
  type = string
}

variable "execution_role_arn" {
  type = string
}

variable "task_role_arn" {
  type = string
}

variable "target_group_arns" {
  type = map(string)
}

variable "services" {
  type = map(object({
    image         = string
    cpu           = number
    memory        = number
    port          = number
    desired_count = number
    environment   = map(string)
    secrets       = map(string)
  }))
  validation {
    condition = length(var.services) > 0 && alltrue([
      for service in values(var.services) :
      can(regex("^[0-9]{12}\\.dkr\\.ecr\\.[a-z0-9-]+\\.amazonaws\\.com/.+@sha256:[0-9a-f]{64}$", service.image)) &&
      service.port >= 1 && service.port <= 65535 && service.desired_count >= 1
    ])
    error_message = "services require ECR digest images, valid ports, and positive desired counts."
  }
}

variable "tags" {
  type = map(string)
}

resource "aws_ecs_cluster" "this" {
  name = var.name
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
  tags = merge(var.tags, { Name = var.name })
}

resource "aws_security_group" "service" {
  name        = "${var.name}-services"
  description = "Fargate services receive traffic from the platform ALB only"
  vpc_id      = var.vpc_id
  egress      = []
  tags        = merge(var.tags, { Name = "${var.name}-services" })
}

resource "aws_vpc_security_group_ingress_rule" "alb" {
  for_each                     = var.services
  security_group_id            = aws_security_group.service.id
  referenced_security_group_id = var.alb_security_group_id
  from_port                    = each.value.port
  to_port                      = each.value.port
  ip_protocol                  = "tcp"
  description                  = "ALB to ${each.key}"
}

resource "aws_cloudwatch_log_group" "service" {
  for_each          = var.services
  name              = "/aiops/${var.name}/${each.key}"
  retention_in_days = 30
  tags              = var.tags
}

resource "aws_ecs_task_definition" "service" {
  for_each                 = var.services
  family                   = "${var.name}-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = tostring(each.value.cpu)
  memory                   = tostring(each.value.memory)
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([{
    name      = each.key
    image     = each.value.image
    essential = true
    portMappings = [{
      containerPort = each.value.port
      hostPort      = each.value.port
      protocol      = "tcp"
    }]
    environment = [for key, value in each.value.environment : { name = key, value = value }]
    secrets     = [for key, value in each.value.secrets : { name = key, valueFrom = value }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.service[each.key].name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = each.key
      }
    }
  }])
  tags = var.tags
}

resource "aws_ecs_service" "service" {
  for_each                          = var.services
  name                              = each.key
  cluster                           = aws_ecs_cluster.this.arn
  task_definition                   = aws_ecs_task_definition.service[each.key].arn
  desired_count                     = each.value.desired_count
  launch_type                       = "FARGATE"
  health_check_grace_period_seconds = 60
  enable_execute_command            = false

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.service.id]
    assign_public_ip = false
  }
  load_balancer {
    target_group_arn = var.target_group_arns[each.key]
    container_name   = each.key
    container_port   = each.value.port
  }
  tags = merge(var.tags, { Name = "${var.name}-${each.key}" })

  lifecycle {
    precondition {
      condition     = contains(keys(var.target_group_arns), each.key)
      error_message = "every ECS service requires a matching target group."
    }
  }
}

output "cluster_arn" {
  value = aws_ecs_cluster.this.arn
}

output "service_security_group_id" {
  value = aws_security_group.service.id
}

output "service_arns" {
  value = { for name, service in aws_ecs_service.service : name => service.id }
}
