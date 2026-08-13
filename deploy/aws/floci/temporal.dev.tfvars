# 根拠: DEV-T01 / ADR-0029 / ENV-DEC-002 — Floci-only synthetic values, never AWS credentials.
environment                     = "dev"
aws_region                      = "ap-northeast-1"
vpc_id                          = "vpc-00000000000000000"
private_subnet_ids              = ["subnet-00000000000000000"]
ecs_cluster_arn                 = "arn:aws:ecs:ap-northeast-1:000000000000:cluster/floci-dev"
worker_security_group_id        = "sg-00000000000000001"
execution_role_arn              = "arn:aws:iam::000000000000:role/floci-temporal-execution"
task_role_arn                   = "arn:aws:iam::000000000000:role/floci-temporal-task"
temporal_image                  = "000000000000.dkr.ecr.ap-northeast-1.amazonaws.com/temporal@sha256:0000000000000000000000000000000000000000000000000000000000000000"
jwks_sidecar_image              = "000000000000.dkr.ecr.ap-northeast-1.amazonaws.com/busybox@sha256:0000000000000000000000000000000000000000000000000000000000000000"
rds_security_group_id           = "sg-00000000000000002"
vpc_endpoints_security_group_id = "sg-00000000000000003"
db_host                         = "temporal-db.floci.internal"
worker_names                    = ["incident-w1", "report-w1"]
