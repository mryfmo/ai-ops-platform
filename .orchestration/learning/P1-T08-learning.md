# P1-T08 learning

- Keep required check contexts stable by adding contract and policy gates as steps inside the existing `build-test` job.
- Use the same mise tasks locally and in GitHub CI; CI supplies a version-and-SHA-pinned OPA binary while local execution deliberately detects an operator-managed binary.
- Independent contract workspaces must run their own frozen install instead of being absorbed into the root pnpm workspace.
- No separate project worklog learn was added because the workflow comments and executable gates encode these validated decisions.
