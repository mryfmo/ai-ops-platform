# P3-T09 sandbox record

- Temporal: no server or namespace used; only existing pure schedule-option builders ran with fixed clock and `executionMode: "shadow"`.
- External APIs: no Graph, GitHub, Plane, HTTP, or other external API request was made.
- PostgreSQL: only explicit disposable P3-T09 databases are used for the repository CI gate.
- Filesystem: esbuild creates a temporary runner bundle as verification setup; the comparison itself runs under Node permissions with repository/temp reads only and writes JSON only to stdout. The temporary bundle is removed after the test.
