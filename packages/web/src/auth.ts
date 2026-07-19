/**
 * packages/web/src/auth.ts
 *
 * 根拠: ADR-0005 / DevOps:SPEC-INT-054。
 *   Auth.js v5 + Microsoft Entra ID の OIDC 検証済み claims から stable subject を作り、
 *   JWT/session には canonical tenant/object ID と opaque roles だけを保持する。
 *
 * 注意: next-auth は AUTH_MICROSOFT_ENTRA_ID_ID / AUTH_MICROSOFT_ENTRA_ID_SECRET /
 *   AUTH_MICROSOFT_ENTRA_ID_TENANT_ID を規約に沿った環境変数名として自動解決するが、
 *   本ファイルではモジュールロード時に例外を投げないよう明示的な必須値チェックは行わない
 *   （fail-fastな検証は server/config.ts の loadWebConfig() が API Route 等の実行時に担う）。
 */
import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { toEntraJwt, toEntraSession } from "./server/entraClaims";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID
        ? `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID}/v2.0`
        : undefined,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      return toEntraJwt(token, account && profile ? profile : undefined, process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID);
    },
    async session({ session, token }) {
      return toEntraSession(session, token, process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID);
    },
  },
});
