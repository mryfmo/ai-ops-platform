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

variable "vpc_cidr" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
  validation {
    condition     = length(var.public_subnet_ids) >= 2
    error_message = "ALB requires at least two public subnets."
  }
}

variable "cloudfront_origin_prefix_list_id" {
  type = string
  validation {
    condition     = can(regex("^pl-[0-9a-f]{8,17}$", var.cloudfront_origin_prefix_list_id))
    error_message = "cloudfront_origin_prefix_list_id must be an AWS prefix-list ID."
  }
}

variable "certificate_arn" {
  type = string
}

variable "target_groups" {
  type = map(object({
    port          = number
    health_path   = string
    path_patterns = list(string)
  }))
  validation {
    condition     = length(var.target_groups) > 0 && alltrue([for target in values(var.target_groups) : target.port >= 1 && target.port <= 65535])
    error_message = "target_groups must contain valid ports."
  }
}

variable "tags" {
  type = map(string)
}

locals {
  ordered_target_names = sort(keys(var.target_groups))
}

resource "aws_security_group" "this" {
  name        = "${var.name}-alb"
  description = "HTTPS from the CloudFront origin-facing managed prefix list only"
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = "${var.name}-alb" })
}

resource "aws_vpc_security_group_ingress_rule" "cloudfront" {
  security_group_id = aws_security_group.this.id
  prefix_list_id    = var.cloudfront_origin_prefix_list_id
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  description       = "CloudFront origin traffic only"
}

resource "aws_vpc_security_group_egress_rule" "targets" {
  for_each          = var.target_groups
  security_group_id = aws_security_group.this.id
  cidr_ipv4         = var.vpc_cidr
  from_port         = each.value.port
  to_port           = each.value.port
  ip_protocol       = "tcp"
  description       = "ALB to ${each.key} targets inside the VPC"
}

resource "aws_lb" "this" {
  name                       = var.name
  internal                   = false
  load_balancer_type         = "application"
  security_groups            = [aws_security_group.this.id]
  subnets                    = var.public_subnet_ids
  drop_invalid_header_fields = true
  enable_deletion_protection = var.environment == "prod"
  tags                       = merge(var.tags, { Name = var.name })
}

resource "aws_lb_target_group" "this" {
  for_each    = var.target_groups
  name        = substr("${var.name}-${each.key}", 0, 32)
  port        = each.value.port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id

  health_check {
    enabled             = true
    path                = each.value.health_path
    protocol            = "HTTP"
    matcher             = "200-399"
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
  tags = merge(var.tags, { Name = "${var.name}-${each.key}" })
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "application/json"
      message_body = "{\"error\":\"not_found\"}"
      status_code  = "404"
    }
  }
}

resource "aws_lb_listener_rule" "service" {
  for_each     = var.target_groups
  listener_arn = aws_lb_listener.https.arn
  priority     = 100 + index(local.ordered_target_names, each.key)

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this[each.key].arn
  }
  condition {
    path_pattern {
      values = each.value.path_patterns
    }
  }
}

output "arn" {
  value = aws_lb.this.arn
}

output "dns_name" {
  value = aws_lb.this.dns_name
}

output "security_group_id" {
  value = aws_security_group.this.id
}

output "target_group_arns" {
  value = { for name, target in aws_lb_target_group.this : name => target.arn }
}
