// 本日(ローカル日付)にplay_logsへ記録された、重複を除いたstudy_item_id数を集計するリポジトリ実装
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DailyProgressRepository } from "./types";

interface PlayLogStudyItemRow {
  study_item_id: string;
}

function localDayRangeAsUtcIso(now: Date): { startUtc: string; endUtc: string } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}

export class SupabaseDailyProgressRepository implements DailyProgressRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async fetchTodayStudiedCount(): Promise<number> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) {
      throw new Error("ログインが必要です。");
    }

    const { startUtc, endUtc } = localDayRangeAsUtcIso(new Date());

    const { data, error } = await this.supabase
      .from("play_logs")
      .select("study_item_id")
      .eq("user_id", user.id)
      .gte("created_at", startUtc)
      .lt("created_at", endUtc)
      .returns<PlayLogStudyItemRow[]>();

    if (error) {
      throw error;
    }

    const uniqueStudyItemIds = new Set((data ?? []).map((row) => row.study_item_id));
    return uniqueStudyItemIds.size;
  }
}
