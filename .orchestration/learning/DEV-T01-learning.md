# DEV-T01 learning

## L-DEV-T01-01: Apple container is not a Docker socket runtime

Floci can emulate many AWS control-plane calls in-process, but its Docker-backed ECS/RDS
paths expect Docker Compose and `/var/run/docker.sock`. The repository's Apple-container
Temporal smoke remains separate. Local Floci validation must skip explicitly until the
Owner supplies a Docker-compatible runtime such as Colima.

## L-DEV-T01-02: isolate provider overrides rather than condition production code

Keeping the endpoint/dummy credential provider in a `.tf.example` file and activating it
only in an ephemeral module copy preserves the exact production resource graph without
adding environment conditionals to `main.tf` or `variables.tf`.

## L-DEV-T01-03: Terraform provider execution may need a less restrictive local sandbox

Provider installation succeeded with network access, but the downloaded provider could
not complete its plugin handshake in the restricted command sandbox. Running the same
ephemeral validate outside that restriction succeeded. This is a local tooling constraint,
not evidence of a Terraform configuration failure.
