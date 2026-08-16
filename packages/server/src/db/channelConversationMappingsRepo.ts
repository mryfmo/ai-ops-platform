/**
 * 根拠: FinalArch:PRD-001 / FinalArch:FR-UI-001 / FinalArch:FR-UI-003 /
 * FinalArch:FR-UI-006 / ADR-0025 / UX-001。
 * channel address と initiating identity に束縛された workflow mapping の DB 正本。
 */
import type { PgQueryable } from "@aiops/shared";

export interface ChannelMappingAddress {
  source: string;
  platformConversationId: string;
  platformThreadId: string | null;
}

export interface ChannelMappingIdentity {
  provider: string;
  tenantId: string | null;
  subjectId: string;
}

export interface ChannelConversationMappingRegistration {
  address: ChannelMappingAddress;
  identity: ChannelMappingIdentity & { tenantId: string };
  conversationId: string;
  threadId: string;
  workflowId: string;
}

export type ChannelConversationMapping = ChannelConversationMappingRegistration;

function present(value: string | null): value is string {
  return value !== null && value.trim().length > 0;
}

function validAddress(address: ChannelMappingAddress): boolean {
  return (
    present(address.source) &&
    present(address.platformConversationId) &&
    (address.platformThreadId === null || present(address.platformThreadId))
  );
}

function validIdentity(identity: ChannelMappingIdentity): identity is ChannelMappingIdentity & { tenantId: string } {
  return present(identity.provider) && present(identity.tenantId) && present(identity.subjectId);
}

function toMapping(row: Record<string, unknown>): ChannelConversationMapping {
  return {
    address: {
      source: String(row.source),
      platformConversationId: String(row.platform_conversation_id),
      platformThreadId: row.platform_thread_id === null ? null : String(row.platform_thread_id),
    },
    identity: {
      provider: String(row.identity_provider),
      tenantId: String(row.tenant_id),
      subjectId: String(row.subject_id),
    },
    conversationId: String(row.conversation_id),
    threadId: String(row.thread_id),
    workflowId: String(row.workflow_id),
  };
}

function sameMapping(left: ChannelConversationMapping, right: ChannelConversationMapping): boolean {
  return (
    left.address.source === right.address.source &&
    left.address.platformConversationId === right.address.platformConversationId &&
    left.address.platformThreadId === right.address.platformThreadId &&
    left.identity.provider === right.identity.provider &&
    left.identity.tenantId === right.identity.tenantId &&
    left.identity.subjectId === right.identity.subjectId &&
    left.conversationId === right.conversationId &&
    left.threadId === right.threadId &&
    left.workflowId === right.workflowId
  );
}

export class ChannelConversationMappingsRepo {
  constructor(private readonly db: PgQueryable) {}

  async lookup(
    address: ChannelMappingAddress,
    identity: ChannelMappingIdentity,
  ): Promise<ChannelConversationMapping | null> {
    if (!validAddress(address) || !validIdentity(identity)) return null;
    const result = await this.db.query(
      `SELECT source, platform_conversation_id, platform_thread_id,
              identity_provider, tenant_id, subject_id,
              conversation_id, thread_id, workflow_id
         FROM channel_conversation_mappings
        WHERE source = $1
          AND platform_conversation_id = $2
          AND platform_thread_id IS NOT DISTINCT FROM $3
          AND identity_provider = $4
          AND tenant_id = $5
          AND subject_id = $6`,
      [
        address.source,
        address.platformConversationId,
        address.platformThreadId,
        identity.provider,
        identity.tenantId,
        identity.subjectId,
      ],
    );
    return result.rows[0] ? toMapping(result.rows[0]) : null;
  }

  async register(mapping: ChannelConversationMappingRegistration): Promise<"created" | "replayed"> {
    if (
      !validAddress(mapping.address) ||
      !validIdentity(mapping.identity) ||
      !present(mapping.conversationId) ||
      !present(mapping.threadId) ||
      !present(mapping.workflowId)
    ) {
      throw new TypeError("conversation mapping fields must be non-empty");
    }

    const inserted = await this.db.query(
      `INSERT INTO channel_conversation_mappings (
         source, platform_conversation_id, platform_thread_id,
         identity_provider, tenant_id, subject_id,
         conversation_id, thread_id, workflow_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT DO NOTHING`,
      [
        mapping.address.source,
        mapping.address.platformConversationId,
        mapping.address.platformThreadId,
        mapping.identity.provider,
        mapping.identity.tenantId,
        mapping.identity.subjectId,
        mapping.conversationId,
        mapping.threadId,
        mapping.workflowId,
      ],
    );
    if ((inserted.rowCount ?? 0) === 1) return "created";

    const existing = await this.findByAddress(mapping.address);
    if (!existing || !sameMapping(existing, mapping)) throw new Error("conversation mapping conflict");
    return "replayed";
  }

  private async findByAddress(address: ChannelMappingAddress): Promise<ChannelConversationMapping | null> {
    const result = await this.db.query(
      `SELECT source, platform_conversation_id, platform_thread_id,
              identity_provider, tenant_id, subject_id,
              conversation_id, thread_id, workflow_id
         FROM channel_conversation_mappings
        WHERE source = $1
          AND platform_conversation_id = $2
          AND platform_thread_id IS NOT DISTINCT FROM $3`,
      [address.source, address.platformConversationId, address.platformThreadId],
    );
    return result.rows[0] ? toMapping(result.rows[0]) : null;
  }
}
