// 根拠: ADR-0024 / WIQ-003 / FinalArch:INV-007
export type { GraphAppOnlyToken } from "@aiops/shared";
import type { GraphClient, GraphTokenProvider } from "@aiops/shared";

export type GraphAppOnlyTokenProvider = GraphTokenProvider;

export type GraphSubscriptionOperations = Pick<GraphClient, "createSubscription">;

export type GraphLifecycleOperations = Pick<GraphClient, "renewSubscription" | "deleteSubscription">;

export type GraphDeltaOperations = Pick<
  GraphClient,
  "getChannelMessage" | "getChannelMessagesDelta" | "listMessageReplies"
>;

export type GraphFormalWriteOperations = Pick<GraphClient, "sendAdaptiveCard" | "sendMail" | "replyToMessage">;

export type GraphSystemClient = GraphSubscriptionOperations &
  GraphLifecycleOperations &
  GraphDeltaOperations &
  GraphFormalWriteOperations & {
    readonly authenticationMode: "app-only";
  };
