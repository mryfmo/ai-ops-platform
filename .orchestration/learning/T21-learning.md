# T21 Learning

## Reusable Learnings

- Delivery surfaces that share one report/recipient id can mask partial failure. Separate idempotency keys are the smallest reliable fix when email and Teams card delivery have independent failure modes.
- `Intl.Segmenter` is available in the current Node runtime and is the right standard-library tool for report slot character limits. Fallbacks should normalize before splitting.
- GitHub deployment events do not safely imply an ai-ops project id from `environment`; preserving `projectId: null` avoids accidental persona-scope filtering while still counting deployment events.
- `buildHolidayCalendar` expects full `HolidayEntry` objects. Tests using string arrays silently fail to register holidays.
- Avoid locale-dependent `new Date(string)` for import data. Accept explicit ISO-like dates or reject with a row error.
- Shared domain errors that are ordinary `Error` instances need HTTP-boundary mapping if they represent client input mistakes.

## Plan Updates

- No new project plan is required. These points should guide future delivery/idempotency, calendar, import-date, and API-boundary tests.
