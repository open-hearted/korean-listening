// 学習画面（Server Component）: 未ログインなら /login へリダイレクト
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StudyCard } from "@/components/StudyCard";
import { LogoutButton } from "@/components/LogoutButton";
import { DailyStudyRing } from "@/components/DailyStudyRing";

export default async function LearnPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-end gap-3 p-4">
        <DailyStudyRing />
        <LogoutButton />
      </header>
      <main className="flex flex-1 flex-col">
        <StudyCard />
      </main>
    </div>
  );
}
