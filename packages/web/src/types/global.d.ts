/**
 * packages/web/src/types/global.d.ts
 *
 * 根拠: ADR-0005 / DevOps:SPEC-INT-054。
 * next-env.d.ts（gitignore対象・next build時に自動生成）が存在しない状態でも
 * `tsc --noEmit` の型チェックが通るよう、CSS副作用importと非PII Entra sessionを宣言する。
 */
import type { DefaultSession } from "next-auth";
import "next-auth/jwt";

declare module "*.css";

declare module "next-auth" {
  interface Session {
    user?: DefaultSession["user"] & {
      subject?: {
        tenantId: string;
        objectId: string;
      };
      roles?: string[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    entraTenantId?: string;
    entraObjectId?: string;
    entraRoles?: string[];
  }
}
