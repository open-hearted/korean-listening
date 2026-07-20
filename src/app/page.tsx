// ルートページ: ログイン状態に応じて /login または /learn へリダイレクト
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/learn");
  } else {
    redirect("/login");
  }
}
