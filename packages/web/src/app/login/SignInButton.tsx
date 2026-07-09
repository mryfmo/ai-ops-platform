/**
 * packages/web/src/app/login/SignInButton.tsx
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。signIn() はクライアント側APIのため
 * "use client" コンポーネントとして分離する（login/page.tsx はServer Componentのまま維持）。
 */
"use client";

import { signIn } from "next-auth/react";

export function SignInButton() {
  return (
    <button
      type="button"
      onClick={() => signIn("microsoft-entra-id")}
      className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
    >
      Microsoftでサインイン
    </button>
  );
}
