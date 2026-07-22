// Supabase の ai_questions テーブルから質問履歴を取得するリポジトリ実装
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiQuestion, AiQuestionRepository } from "./types";

interface AiQuestionRow {
  id: string;
  question: string;
  answer: string;
  created_at: string;
}

function toAiQuestion(row: AiQuestionRow): AiQuestion {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    createdAt: row.created_at,
  };
}

export class SupabaseAiQuestionRepository implements AiQuestionRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async list(studyItemId: string): Promise<AiQuestion[]> {
    const { data, error } = await this.supabase
      .from("ai_questions")
      .select("id, question, answer, created_at")
      .eq("study_item_id", studyItemId)
      .order("created_at", { ascending: false })
      .returns<AiQuestionRow[]>();

    if (error) {
      throw error;
    }

    return (data ?? []).map(toAiQuestion);
  }
}
