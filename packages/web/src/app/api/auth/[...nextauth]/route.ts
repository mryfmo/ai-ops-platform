/**
 * packages/web/src/app/api/auth/[...nextauth]/route.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。Auth.js v5 の標準的なRoute Handler接続。
 * GET/POST を ../../../auth.ts の handlers にそのまま委譲する。
 */
import { handlers } from "../../../../auth";

export const { GET, POST } = handlers;
