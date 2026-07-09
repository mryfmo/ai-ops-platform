/**
 * packages/web/src/auth.ts
 *
 * 根拠: ADR-0005（WebUIダッシュボード + 常駐サーバ統合）。
 *   WebUIのペルソナ別表示切替（PrjOps PRF-01〜05 / DevOps PRF-M/L/G）の起点となる認証を
 *   Auth.js v5（next-auth@beta） + Microsoft Entra ID プロバイダで実装する。
 *   セッションはJWT方式（DBセッションストアを追加導入しない。既存DevOps正本DBの責務を増やさない）。
 *   session callback で token.email / token.sub（Entra IDのoidに対応するsub）を
 *   session.user へ伝播し、personaResolver（./server/personaResolver.ts）がemailで
 *   PrjOps/DevOpsのペルソナを解決できるようにする。
 *
 * 注意: next-auth は AUTH_MICROSOFT_ENTRA_ID_ID / AUTH_MICROSOFT_ENTRA_ID_SECRET /
 *   AUTH_MICROSOFT_ENTRA_ID_TENANT_ID を規約に沿った環境変数名として自動解決するが、
 *   本ファイルではモジュールロード時に例外を投げないよう明示的な必須値チェックは行わない
 *   （fail-fastな検証は server/config.ts の loadWebConfig() が API Route 等の実行時に担う）。
 */
import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

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
      if (account && profile) {
        token.email = typeof profile.email === "string" ? profile.email : token.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = typeof token.email === "string" ? token.email : session.user.email;
        session.user.id = typeof token.sub === "string" ? token.sub : session.user.id;
      }
      return session;
    },
  },
});
