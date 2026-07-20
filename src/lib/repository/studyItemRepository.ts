// Supabase の study_items テーブルからランダムに1件取得するリポジトリ実装
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StudyFilter, StudyItem, StudyItemRepository } from "./types";

interface StudyItemRow {
  id: string;
  ja_text: string;
  ko_text: string;
  ipa: string;
  ja_ipa: string | null;
  ja_audio_url: string;
  ko_audio_url: string;
}

function toStudyItem(row: StudyItemRow): StudyItem {
  return {
    id: row.id,
    jaText: row.ja_text,
    koText: row.ko_text,
    ipa: row.ipa,
    jaIpa: row.ja_ipa,
    jaAudioUrl: row.ja_audio_url,
    koAudioUrl: row.ko_audio_url,
  };
}

export class SupabaseStudyItemRepository implements StudyItemRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async fetchNext(filter?: StudyFilter): Promise<StudyItem | null> {
    let countQuery = this.supabase
      .from("study_items")
      .select("*", { count: "exact", head: true });

    if (filter?.koTextContains) {
      countQuery = countQuery.ilike("ko_text", `%${filter.koTextContains}%`);
    }

    const { count, error: countError } = await countQuery;
    if (countError) {
      throw countError;
    }
    if (!count || count === 0) {
      return null;
    }

    const randomOffset = Math.floor(Math.random() * count);

    let selectQuery = this.supabase.from("study_items").select("*");
    if (filter?.koTextContains) {
      selectQuery = selectQuery.ilike("ko_text", `%${filter.koTextContains}%`);
    }

    const { data, error } = await selectQuery
      .range(randomOffset, randomOffset)
      .limit(1)
      .maybeSingle<StudyItemRow>();

    if (error) {
      throw error;
    }
    if (!data) {
      return null;
    }

    return toStudyItem(data);
  }
}
