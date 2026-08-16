// 根拠: ADR-0024 / WIQ-003 / FinalArch:INV-007
import { describe, expect, it } from "vitest";

import { GraphClient } from "@aiops/shared";
import {
  type GraphAppOnlyToken,
  type GraphAppOnlyTokenProvider,
  type GraphFormalWriteOperations,
  type GraphSystemClient,
} from "../src/graph/systemClient.js";
import type { WorkIqDelegatedToken, WorkIqDelegatedTokenProvider, WorkIqRestClient } from "../src/workiq/restClient.js";

describe("Graph app-only interface [ADR-0024] [WIQ-003]", () => {
  it("marks the concrete Graph client as app-only", () => {
    const token = "synthetic-app-token" as GraphAppOnlyToken;
    const client = new GraphClient({ getAccessToken: async () => token });
    expect(client.authenticationMode).toBe("app-only");
  });
});

// This function is never called. `tsc` checks every @ts-expect-error while Vitest safely ignores the body.
function assertCompileTimeSeparation(delegatedToken: WorkIqDelegatedToken, delegatedClient: WorkIqRestClient): void {
  const appOnlyToken = "synthetic-app-token" as GraphAppOnlyToken;
  const appOnlyProvider: GraphAppOnlyTokenProvider = {
    getAccessToken: async () => appOnlyToken,
  };
  const graphClient = new GraphClient(appOnlyProvider);
  const systemClient: GraphSystemClient = graphClient;
  const delegatedGraphShape = {
    getAccessToken: async () => delegatedToken.accessToken,
  };

  // @ts-expect-error ADR-0024: a delegated bearer shape cannot construct the concrete Graph client.
  new GraphClient(delegatedGraphShape);
  // @ts-expect-error ADR-0024: a Work IQ delegated token is not a Graph app-only token.
  const rejectedGraphToken: GraphAppOnlyToken = delegatedToken;
  // @ts-expect-error ADR-0024: an unbranded delegated bearer is not a Graph app-only token.
  const rejectedRawBearer: GraphAppOnlyToken = delegatedToken.accessToken;
  // @ts-expect-error ADR-0024: a Graph app-only token is not a Work IQ delegated token.
  const rejectedDelegatedToken: WorkIqDelegatedToken = appOnlyToken;
  // @ts-expect-error ADR-0024: an app-only provider cannot replace the Work IQ delegated provider.
  const rejectedDelegatedProvider: WorkIqDelegatedTokenProvider = appOnlyProvider;
  // @ts-expect-error ADR-0024: delegated Work IQ clients cannot perform Graph formal writes.
  const rejectedFormalWrites: GraphFormalWriteOperations = delegatedClient;

  void [
    systemClient,
    rejectedGraphToken,
    rejectedRawBearer,
    rejectedDelegatedToken,
    rejectedDelegatedProvider,
    rejectedFormalWrites,
  ];
}

void assertCompileTimeSeparation;
