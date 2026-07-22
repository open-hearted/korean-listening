// Supabase の insights テーブルへ気付きメモを保存・取得するリポジトリ実装
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Insight, InsightRepository } from "./types";

interface InsightRow {
  id: string;
  note: string;
  created_at: string;
}

function toInsight(row: InsightRow): Insight {
  return { id: row.id, note: row.note, createdAt: row.created_at };
}

export class SupabaseInsightRepository implements InsightRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async save(studyItemId: string, note: string): Promise<void> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) {
      throw new Error("ログインが必要です。");
    }

    const { error } = await this.supabase.from("insights").insert({
      user_id: user.id,
      study_item_id: studyItemId,
      note,
    });

    if (error) {
      throw error;
    }
  }

  async list(studyItemId: string): Promise<Insight[]> {
    const { data, error } = await this.supabase
      .from("insights")
      .select("id, note, created_at")
      .eq("study_item_id", studyItemId)
      .order("created_at", { ascending: false })
      .returns<InsightRow[]>();

    if (error) {
      throw error;
    }

    return (data ?? []).map(toInsight);
  }
}
