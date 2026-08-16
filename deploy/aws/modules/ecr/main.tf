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

variable "names" {
  type = set(string)
  validation {
    condition     = length(var.names) > 0
    error_message = "at least one ECR repository name is required."
  }
}

variable "tags" {
  type = map(string)
}

resource "aws_ecr_repository" "this" {
  for_each             = var.names
  name                 = each.key
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false

  image_scanning_configuration {
    scan_on_push = true
  }
  encryption_configuration {
    encryption_type = "AES256"
  }
  tags = merge(var.tags, { Name = each.key })
}

resource "aws_ecr_lifecycle_policy" "this" {
  for_each   = aws_ecr_repository.this
  repository = each.value.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Expire untagged images after seven days"
      selection = {
        tagStatus   = "untagged"
        countType   = "sinceImagePushed"
        countUnit   = "days"
        countNumber = 7
      }
      action = { type = "expire" }
    }]
  })
}

output "repository_arns" {
  value = { for name, repository in aws_ecr_repository.this : name => repository.arn }
}

output "repository_urls" {
  value = { for name, repository in aws_ecr_repository.this : name => repository.repository_url }
}
