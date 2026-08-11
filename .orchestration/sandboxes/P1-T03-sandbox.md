<!-- 根拠: ADR-0023 -->

# P1-T03 sandbox

- OpenSandbox was not needed.
- Validation ran in the local repository with OPA 1.19.0 and three explicitly
  disposable local PostgreSQL databases on `127.0.0.1:55432`.
- Bundle output was written only to `/private/tmp/p1-t03-policy-bundle.tar.gz`.
- No production environment, external policy service, or persistent deployment
  was touched.
