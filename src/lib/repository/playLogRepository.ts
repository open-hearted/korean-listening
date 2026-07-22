// Supabase の play_logs テーブルへ再生ログを記録するリポジトリ実装
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyPlayLogRecorded } from "@/lib/events/playLogEvents";
import type { PlayLogRepository, PlayType } from "./types";

export class SupabasePlayLogRepository implements PlayLogRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  record(playType: PlayType, studyItemId: string): void {
    void this.insert(playType, studyItemId);
  }

  private async insert(playType: PlayType, studyItemId: string): Promise<void> {
    try {
      const {
        data: { user },
      } = await this.supabase.auth.getUser();
      if (!user) {
        console.error("play_logs insert skipped: no authenticated user");
        return;
      }

      const { error } = await this.supabase.from("play_logs").insert({
        user_id: user.id,
        study_item_id: studyItemId,
        play_type: playType,
      });

      if (error) {
        console.error("play_logs insert failed", error);
        return;
      }

      notifyPlayLogRecorded();
    } catch (error) {
      console.error("play_logs insert failed", error);
    }
  }
}
