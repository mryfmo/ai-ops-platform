// 根拠: FinalArch:PRD-008 / FinalArch:COD-002 / FinalArch:COD-004 / ADR-0027 / WBS P8-T03
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  fileURLToPath(new URL("../../../.github/workflows/coding-task.yml", import.meta.url)),
  "utf8",
);

function step(name: string, nextName: string): string {
  const start = workflow.indexOf(`- name: ${name}`);
  const end = workflow.indexOf(`- name: ${nextName}`, start + 1);
  expect(start, `${name} exists`).toBeGreaterThan(-1);
  expect(end, `${nextName} follows ${name}`).toBeGreaterThan(start);
  return workflow.slice(start, end);
}

describe("coding-task credential workflow [FinalArch:COD-002][FinalArch:COD-004]", () => {
  it("uses audience-bound GitHub OIDC and contains no long-lived runner credential secret", () => {
    expect(workflow).toMatch(/permissions:\s+contents: read\s+id-token: write/u);
    expect(workflow).toContain("ACTIONS_ID_TOKEN_REQUEST_URL");
    expect(workflow).toContain("ACTIONS_ID_TOKEN_REQUEST_TOKEN");
    expect(workflow).toContain("audience=");
    expect(workflow).toContain("*$'\\r'*");
    expect(workflow).not.toContain("secrets.LITELLM_CODING_VIRTUAL_KEY");
    expect(workflow).not.toContain("secrets.AIOPS_PR_TOKEN");
    expect(workflow).not.toContain("secrets.LITELLM_MASTER_KEY");
    expect(workflow).not.toContain("secrets.GITHUB_APP_PRIVATE_KEY");
  });

  it("passes the virtual key only to the coding action and mints GitHub credentials after the agent", () => {
    const issueLiteLlm = step("Issue job-scoped LiteLLM credential", "Run coding agent (ADR-0006 composite action)");
    const runAgent = step("Run coding agent (ADR-0006 composite action)", "Revoke job-scoped LiteLLM credential");
    const issueGitHub = step("Issue repository-scoped GitHub credential", "Push agent branch");
    const push = step("Push agent branch", "Create pull request");
    const createPr = step("Create pull request", "Revoke repository-scoped GitHub credential");

    expect(issueLiteLlm).toContain("/v1/runner-credentials/litellm/issue");
    expect(runAgent).toContain("steps.issue_litellm.outputs.token");
    expect(runAgent).not.toContain("steps.issue_github.outputs.token");
    expect(workflow.indexOf("- name: Issue repository-scoped GitHub credential")).toBeGreaterThan(
      workflow.indexOf("- name: Run coding agent (ADR-0006 composite action)"),
    );
    expect(issueGitHub).toContain("/v1/runner-credentials/github/issue");
    expect(push).toContain("steps.issue_github.outputs.token");
    expect(createPr).toContain("steps.issue_github.outputs.token");
  });

  it("always revokes each issued lease and keeps the push target off main", () => {
    const revokeLiteLlm = step("Revoke job-scoped LiteLLM credential", "Detect changes");
    const revokeGitHub = step("Revoke repository-scoped GitHub credential", "Callback success (pr_created)");
    const push = step("Push agent branch", "Create pull request");

    expect(revokeLiteLlm).toContain("if: ${{ always()");
    expect(revokeLiteLlm).toContain("/v1/runner-credentials/litellm/revoke");
    expect(revokeLiteLlm).toContain("steps.issue_litellm.outputs.lease_id");
    expect(revokeGitHub).toContain("if: ${{ always()");
    expect(revokeGitHub).toContain("/v1/runner-credentials/github/revoke");
    expect(revokeGitHub).toContain("steps.issue_github.outputs.lease_id");
    expect(push).toContain('"${BRANCH_NAME}"');
    expect(push).not.toMatch(/push[^\n]*\bmain\b/u);
  });

  it("fails closed when issuer endpoint, audience, or bounded budget is absent", () => {
    const requireConfig = step("Require scoped credential issuer configuration", "Checkout base_ref");
    expect(requireConfig).toContain("RUNNER_CREDENTIAL_ISSUER_URL");
    expect(requireConfig).toContain("RUNNER_CREDENTIAL_ISSUER_AUDIENCE");
    expect(requireConfig).toContain("LITELLM_CODING_MAX_BUDGET_USD");
    expect(requireConfig).toMatch(/exit 1/u);
  });
});
