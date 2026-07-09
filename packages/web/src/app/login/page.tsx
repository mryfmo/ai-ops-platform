/**
 * packages/web/src/app/login/page.tsx
 *
 * 根拠: ADR-0005（WebUIダッシュボード）。未認証ユーザーの遷移先（middleware.tsから
 * リダイレクトされる簡易ログインページ）。
 */
import { Card } from "../../components/ui/Card";
import { SignInButton } from "./SignInButton";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md">
      <Card title="サインイン">
        <p className="mb-4 text-sm text-gray-600">社内アカウント（Microsoft Entra ID）でサインインしてください。</p>
        <SignInButton />
      </Card>
    </div>
  );
}
