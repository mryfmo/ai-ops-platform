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

variable "origin_domain_name" {
  type = string
}

variable "web_acl_arn" {
  type = string
}

variable "cache_policy_id" {
  type = string
}

variable "aliases" {
  type    = list(string)
  default = []
}

variable "acm_certificate_arn" {
  type     = string
  default  = null
  nullable = true
}

variable "require_custom_certificate" {
  type    = bool
  default = true
}

variable "tags" {
  type = map(string)
}

resource "aws_cloudfront_distribution" "this" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = var.name
  web_acl_id      = var.web_acl_arn
  aliases         = var.aliases

  origin {
    domain_name = var.origin_domain_name
    origin_id   = "${var.name}-alb"
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "${var.name}-alb"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = var.cache_policy_id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = var.acm_certificate_arn == null
    acm_certificate_arn            = var.acm_certificate_arn
    ssl_support_method             = var.acm_certificate_arn == null ? null : "sni-only"
    minimum_protocol_version       = var.acm_certificate_arn == null ? "TLSv1" : "TLSv1.2_2021"
  }

  tags = merge(var.tags, { Name = var.name })

  lifecycle {
    precondition {
      condition = (
        (!var.require_custom_certificate && length(var.aliases) == 0) ||
        (length(var.aliases) > 0 && var.acm_certificate_arn != null)
      )
      error_message = "staging/prod require aliases and an ACM certificate in us-east-1; default certificates are dev-only."
    }
  }
}

output "distribution_id" {
  value = aws_cloudfront_distribution.this.id
}

output "domain_name" {
  value = aws_cloudfront_distribution.this.domain_name
}
