<!-- 根拠: GOV-003 -->

# SEC-REG-P4 learning

- Treat evidence acquisition and approval as separate states: a complete
  inventory changes the evidence fields, never the approver-owned Decision
  record.
- Cargo metadata can omit target-conditional lock entries; reconcile the exact
  lock population and query those versions from crates.io rather than dropping
  them.
- `go mod download all` may expand a writable release checkout's `go.sum`.
  Hash the pristine commit first and discard tool mutations after acquisition.
- Image license labels and embedded SPDX records do not prove that LICENSE or
  NOTICE text is packaged. Export and search the exact digest rootfs, and state
  absence without inferring that obligations disappear.
