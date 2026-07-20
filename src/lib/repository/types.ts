// 学習アイテムおよび検索条件の型定義
export interface StudyItem {
  id: string;
  jaText: string;
  koText: string;
  ipa: string;
  jaAudioUrl: string;
  koAudioUrl: string;
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
