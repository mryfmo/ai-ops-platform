# 根拠: ADR-0029 / REL-001 / P10-T01 — Floci-only synthetic placeholders.
environment          = "dev"
aws_region           = "ap-northeast-1"
vpc_cidr             = "10.40.0.0/16"
availability_zones   = ["ap-northeast-1a", "ap-northeast-1c"]
public_subnet_cidrs  = ["10.40.0.0/24", "10.40.1.0/24"]
private_subnet_cidrs = ["10.40.10.0/24", "10.40.11.0/24"]

cloudfront_origin_prefix_list_id = "pl-00000000000000000"
alb_certificate_arn              = "arn:aws:acm:ap-northeast-1:000000000000:certificate/00000000-0000-0000-0000-000000000000"
alb_origin_domain_name           = "origin.dev.placeholder.invalid"
cloudfront_cache_policy_id       = "00000000-0000-0000-0000-000000000000"
cloudfront_aliases               = []
cloudfront_certificate_arn       = null

github_repository       = "placeholder/ai-ops-platform"
github_oidc_thumbprints = ["0000000000000000000000000000000000000000"]

secret_names = ["entra-client-secret", "litellm-virtual-key"]
services = {
  server = {
    repository    = "server"
    image         = "000000000000.dkr.ecr.ap-northeast-1.amazonaws.com/aiops-dev/server@sha256:0000000000000000000000000000000000000000000000000000000000000000"
    cpu           = 512
    memory        = 1024
    port          = 3000
    desired_count = 1
    health_path   = "/health/ready"
    path_patterns = ["/api/*", "/health/*"]
    environment   = { NODE_ENV = "development" }
    secret_names  = { ENTRA_CLIENT_SECRET = "entra-client-secret", LITELLM_VIRTUAL_KEY = "litellm-virtual-key" }
  }
  web = {
    repository    = "web"
    image         = "000000000000.dkr.ecr.ap-northeast-1.amazonaws.com/aiops-dev/web@sha256:0000000000000000000000000000000000000000000000000000000000000000"
    cpu           = 512
    memory        = 1024
    port          = 3001
    desired_count = 1
    health_path   = "/api/health"
    path_patterns = ["/*"]
    environment   = { NODE_ENV = "development" }
    secret_names  = {}
  }
}

rds_instance_class        = "db.t4g.micro"
rds_allocated_storage_gib = 20
tags = {
  CostCenter = "placeholder"
  Owner      = "platform-placeholder"
}
