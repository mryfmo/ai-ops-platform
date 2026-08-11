# T12 Learning

## Learnings

- AI SDK v5 types in `ai@5.0.210` expose the required stable surface for this task: `streamText`, `stepCountIs`, `prepareStep`, `providerOptions`, `ReasoningUIPart`, `StepStartUIPart`, `ToolUIPart`, and `toUIMessageStreamResponse({ sendReasoning })`.
- Page-agent generative UI can reuse the existing ViewSpec boundary: tool calls return ViewSpec only, and DashboardClient remains responsible for fetching/rendering real dashboard data.
- Client-supplied page context is a trust boundary. It must be reduced to known ViewSpec fields and sanitized before prompt injection.

## Plan Updates

- Future page-agent tools should prefer ViewSpec aliases before introducing new data-returning tool output.
- If chat-side previews become necessary, add per-ViewSpec preview fetches deliberately instead of letting tool execute return raw dashboard data to the LLM.
