# 根拠: FinalArch:PRD-010 / FinalArch:FR-CP-008 / ADR-0029 / REL-001 / P10-T03
mock_provider "aws" {
  override_during = plan
}

variables {
  name                  = "aiops-dev"
  aws_region            = "ap-northeast-1"
  vpc_id                = "vpc-00000000000000000"
  private_subnet_ids    = ["subnet-00000000000000001", "subnet-00000000000000002"]
  alb_security_group_id = "sg-00000000000000000"
  execution_role_arns = {
    server = "arn:aws:iam::000000000000:role/aiops-dev-server-execution"
    web    = "arn:aws:iam::000000000000:role/aiops-dev-ecs-execution"
  }
  task_role_arns = {
    server = "arn:aws:iam::000000000000:role/aiops-dev-server-task"
    web    = "arn:aws:iam::000000000000:role/aiops-dev-ecs-task"
  }
  target_group_arns = {
    server = "arn:aws:elasticloadbalancing:ap-northeast-1:000000000000:targetgroup/server/0000000000000000"
    web    = "arn:aws:elasticloadbalancing:ap-northeast-1:000000000000:targetgroup/web/0000000000000000"
  }
  services = {
    server = {
      image         = "000000000000.dkr.ecr.ap-northeast-1.amazonaws.com/aiops-dev/server@sha256:0000000000000000000000000000000000000000000000000000000000000000"
      cpu           = 512
      memory        = 1024
      port          = 3000
      desired_count = 1
      environment   = {}
      secrets       = { ENTRA_CLIENT_SECRET = "arn:aws:secretsmanager:ap-northeast-1:000000000000:secret:aiops-dev/entra-client-secret-000000" }
    }
    web = {
      image         = "000000000000.dkr.ecr.ap-northeast-1.amazonaws.com/aiops-dev/web@sha256:0000000000000000000000000000000000000000000000000000000000000000"
      cpu           = 512
      memory        = 1024
      port          = 3001
      desired_count = 1
      environment   = {}
      secrets       = {}
    }
  }
  tags = {
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}

run "task_definitions_select_their_own_role_pair" {
  command = plan

  assert {
    condition = (
      aws_ecs_task_definition.service["server"].execution_role_arn == var.execution_role_arns["server"] &&
      aws_ecs_task_definition.service["server"].task_role_arn == var.task_role_arns["server"] &&
      aws_ecs_task_definition.service["web"].execution_role_arn == var.execution_role_arns["web"] &&
      aws_ecs_task_definition.service["web"].task_role_arn == var.task_role_arns["web"]
    )
    error_message = "Every ECS task definition must select the role pair mapped to its own service key."
  }
}
