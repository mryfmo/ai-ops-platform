# P2-T09 learning

LiteLLM's pinned `mock_response` mechanism deterministically exercises gateway routing and transport without provider credentials, while provider-native request/response fixtures are still required to compare the Bedrock Converse and Anthropic Messages envelope differences.

HTTP 503 alone cannot preserve Bedrock's `ModelNotReadyException` versus `ServiceUnavailableException` distinction. A future real-provider adapter must retain the provider error code before applying the shared fail-closed fallback vocabulary.

