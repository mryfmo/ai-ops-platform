# DEV-T01 sandbox record

- OpenSandbox: not used.
- Read-only external access: official GitHub release/repository metadata, Docker Registry
  OCI manifest resolution, and HashiCorp provider download for an ephemeral static check.
- Mutating external access: none. No AWS credentials, account, endpoint, or resource used.
- Local runtime: Docker absent, so Floci execution was explicitly skipped; no runtime was
  installed or configured.
