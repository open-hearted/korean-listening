// Googleログインボタンのみを表示するログインページ
"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const handleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-2xl font-bold">韓国語リスニング学習</h1>
      <button
        type="button"
        onClick={() => void handleLogin()}
        className="rounded-full bg-blue-600 px-6 py-3 text-lg font-semibold text-white"
      >
        Googleでログイン
      </button>
    </div>
  );
}
