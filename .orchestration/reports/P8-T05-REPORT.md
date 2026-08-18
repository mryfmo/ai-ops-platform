# P8-T05 Droid Execution Profile Report

## Outcome

Added a pinned, policy-bounded Droid execution profile beside the accepted Claude profile.
The action verifies the exact Factory CLI 0.174.0 Linux x64 binary, renders committed
runner policy into an isolated home, and defines strict callback evidence. Droid remains
unconditionally fail closed before invocation.

## Security Boundaries

- The direct Factory binary is downloaded from its exact release URL and checked against
  SHA-256 `e73592e3c6fc5a754f21b995f27ef686ca0a5096c9a91f2019fb8a3b10a56bbc`
  before installation; auto-update is disabled.
- Only the scoped LiteLLM virtual key reaches the unreachable execution step. No direct
  provider or Factory credential is provisioned by this task.
- The committed settings and droid policy restrict branch, model route, autonomy, tools,
  network, deployment, dependency installation, and repository mutation.
- Runtime is capped locally. Cost and token ceilings are authoritative at the P8-T03
  issuer-side virtual-key budget and expiry boundary.
- Structured output requires bounded, non-negative numeric evidence and exact nested
  evidence types before action outputs can be emitted.

## Scope Decision

The orchestrator approved option A: this task establishes structure parity only. The gate
must remain unconditional until a FACTORY credential is available, early turn-limit
enforcement is proven through a native flag or approved stream-JSONRPC wrapper, the
issuer-side budget contract is verified, and a real end-to-end run passes. No active
Claude/Droid parity or real Droid execution is claimed.

## Delivery

- Branch: `agent/P8-T05-droid-exec-profile`
- Base: P8-T04 accepted head `be9b4d1e9ac48cf28ee94c3cff1b5d97f233598d`
- Dependencies added: none
- Production configuration changed: none
- Cost: n/a

[memory:decision] Droid cost/token enforcement remains at the scoped virtual-key issuer;
the local profile cannot be activated until turn-limit proof and real E2E evidence exist.
