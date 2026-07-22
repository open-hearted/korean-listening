// 学習アイテムおよび検索条件の型定義
export interface StudyItem {
  id: string;
  jaText: string;
  koText: string;
  ipa: string;
  jaIpa: string | null;
  jaAudioUrl: string;
  koAudioUrl: string;
  enText: string | null;
  enIpa: string | null;
  enAudioUrl: string | null;
  enSyllables: string | null;
}

export interface StudyFilter {
  /** 韓国語テキストに含まれるべき部分文字列（例: "습니다"）。未指定なら全件対象 */
  koTextContains?: string;
  /** 将来の拡張用: 出題順 */
  order?: "random";
}

export interface StudyItemRepository {
  /** filter に合致するデータから1件取得。現状はランダム1件 */
  fetchNext(filter?: StudyFilter): Promise<StudyItem | null>;
}

/** 再生ログの種類。full/repeatは3言語連続再生、ja/en/koは言語別単体再生 */
export type PlayType = "full" | "repeat" | "ja" | "en" | "ko";

export interface PlayLogRepository {
  /** 再生開始時点で1行記録する。完了を待たないfire-and-forget */
  record(playType: PlayType, studyItemId: string): void;
}

export interface Insight {
  id: string;
  note: string;
  createdAt: string;
}

export interface InsightRepository {
  save(studyItemId: string, note: string): Promise<void>;
  /** 指定した例文に紐づく気付きを新しい順で取得する */
  list(studyItemId: string): Promise<Insight[]>;
}

export interface DailyProgressRepository {
  /** 本日(ローカル日付)にplay_logsへ記録された、重複を除いたstudy_item_id数を取得する */
  fetchTodayStudiedCount(): Promise<number>;
}

export interface AiQuestion {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
}

export interface AiQuestionRepository {
  /** 指定した例文に紐づくAI質問履歴を新しい順で取得する */
  list(studyItemId: string): Promise<AiQuestion[]>;
}
