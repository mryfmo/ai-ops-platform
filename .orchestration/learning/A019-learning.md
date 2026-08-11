# A019 Learning Triage

## Reusable Observations

1. A canonical URL parser is not sufficient if auto-selection can consume a
   noncanonical option. Validate the scoped options before sorting,
   auto-selecting, returning them from the picker API, or writing URL state.
2. A list endpoint that forbids selection input must reject the parameter
   before production dependency construction; otherwise missing configuration
   can mask the required 400 response with a 503.
3. Query-spy tests should distinguish the scoped authorization lookup from the
   detail query: unknown IDs need the former but must never reach the latter.

## Promotion Decision

No repository learn file or new skill was promoted. These observations are
recorded as orchestration evidence; A019 forbids worklog edits.
