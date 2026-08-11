<!-- 根拠: FinalArch:CON-004, FinalArch:CON-005, ADR-0023 -->

# P1-T03 learning

- Validated: true.
- OPA Rego v1 requires a `default` complete-rule value to be ground; a helper
  variable cannot appear inside the default object. Keep the bundle version
  literal in the default and test it through bundle validation.
- A tool registry match is insufficient by itself. Bind the declared operation
  and risk to the registered entry, bind the resource system to the tool server,
  and enforce actor project membership before returning a non-deny decision.
- Preserve globally forbidden actions as a separate deny boundary so a future
  catalog mistake cannot register them into an allow path.
- Apply to: future OPA bundle work and P4-T03 policy decision client tests.
