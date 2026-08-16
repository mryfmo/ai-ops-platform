<!-- 根拠: FinalArch:PRD-010 / FinalArch:FR-CP-008 / FinalArch:FR-OBS-005 / ADR-0029 / REL-001 / P10-T01 -->

# AWS Terraform baseline

This tree is the code-only AWS baseline selected by ADR-0029. It defines every
resource in the P10-T01 nine-module scope in Terraform; no AWS Console-created
application resource is accepted. Values under `envs/` are synthetic
placeholders and must not be used for a real AWS plan or apply.

## Modules

| Module            | Code-owned resources                                                              | Boundary                                                                             |
| ----------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `network`         | VPC, public/private subnets, IGW, route tables                                    | Private subnets have no default route; P10-T02 adds reviewed endpoints/egress        |
| `identity`        | GitHub OIDC provider and environment-scoped deploy role; ECS execution/task roles | No long-lived access key and no deploy permission until reviewed policy input exists |
| `ecr`             | Immutable, scan-on-push repositories and lifecycle policy                         | Runtime images must use an ECR digest                                                |
| `secrets-manager` | Secret containers only                                                            | Secret values are never Terraform inputs or state                                    |
| `rds`             | Private encrypted PostgreSQL, managed master password, subnet/SG                  | No public endpoint; 35-day backup retention                                          |
| `alb`             | HTTPS ALB, CloudFront-prefix-list SG, service target groups                       | Direct internet ingress is not allowed by the SG                                     |
| `ecs-fargate`     | Cluster, private services/tasks, logs, service SG                                 | No public IP and no outbound rule until P10-T02                                      |
| `waf`             | CloudFront WAF with managed common rules and rate limit                           | Runs through the `us-east-1` provider alias                                          |
| `cloudfront`      | Public distribution with WAF and HTTPS-only ALB origin                            | The only public application entry point                                              |

The composition root is `envs/main.tf`. Environment separation is expressed by
distinct tfvars, VPC/name/tag namespaces, OIDC subjects, IAM roles, databases,
secrets, and backend configuration. Staging and production must use different
AWS accounts where available, as required by ADR-0029.

## Bootstrap—code and reviewed inputs, not portal-only resources

Before a real environment exists, an Owner performs these auditable prerequisites:

1. Create/select the AWS Organizations account for the environment and record its
   Owner approval outside this repository. Account creation is an organization
   control-plane action, not an application resource.
2. Use a separately reviewed bootstrap Terraform stack to create the environment's
   S3 state bucket and DynamoDB lock table. In an ephemeral deployment checkout,
   copy `envs/backend/backend.tf.example` to `envs/backend.tf`; copy the matching
   `envs/backend/<environment>.hcl.example` outside the repository, replace both
   placeholders, then run `terraform init -backend-config=<reviewed-file>`. Never
   commit the activated backend or resolved backend values.
3. Resolve the AWS-managed CloudFront origin prefix-list ID, regional ALB origin
   DNS/certificate, us-east-1 viewer certificate, CloudFront cache-policy ID,
   GitHub OIDC thumbprint, immutable ECR image digests, sizing, aliases, and tags
   through the ENV gate. Never commit the resolved file.
4. Run a reviewed Terraform plan from a short-lived GitHub OIDC session. The OIDC
   provider/role and all application resources are already represented in code;
   no Console resource creation is part of the procedure.
5. Populate Secrets Manager values through the approved rotation pipeline after
   apply. Terraform deliberately creates no secret version.

Custom DNS and certificate validation records belong in the future
environment-owned DNS bootstrap stack because no DNS zone is selected yet. Dev
uses the default CloudFront certificate; staging/prod fail unless an alias and
us-east-1 certificate are supplied. The ALB origin always uses HTTPS and an
environment-owned origin hostname whose reviewed DNS record targets the
`alb_dns_name` output.

## Local validation

Static validation requires only the pinned Terraform CLI/provider:

```bash
P10_T01_STATIC_ONLY=1 ./deploy/aws/validate-modules.sh
```

The full pre-validation starts the existing digest-pinned Floci service through
a local Docker Compose daemon or the already-installed Apple `container` runtime,
then plans the synthetic dev composition. The Apple path is plan-only and does
not claim the Docker-socket-backed ECS/RDS apply fidelity described under
`floci/`. The script rejects ambient AWS profiles, session/role or container
credentials, non-dummy keys, service-specific endpoint overrides, Terraform
argument injection, and non-loopback endpoints before Terraform or either
container runtime runs:

```bash
./deploy/aws/validate-modules.sh
```

This command never applies resources. A Floci plan proves configuration wiring
only; it is not staging/prod, IAM, network enforcement, durability, quota, RPO/RTO,
or production-readiness evidence. REL-001 remains blocked until a real staging ENV
gate authorizes its own plan/apply.
