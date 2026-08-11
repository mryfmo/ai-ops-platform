# T13 Sandbox Notes

- Network access was not needed.
- Local port bind inside sandbox failed with `listen EPERM`; `next start` and curl to `127.0.0.1:3100` were rerun with approved outside-sandbox execution.
- `tsx` inside sandbox failed with IPC pipe `listen EPERM`; standard report CLI was rerun with approved outside-sandbox execution.
- No destructive actions were used.
- `.orchestration/` files are task artifacts and must not be committed.
