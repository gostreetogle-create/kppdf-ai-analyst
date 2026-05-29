export interface NewsSettings {
  topicsLimit: number;
  rssPauseMs: number;
  curateBatchSize: number;
  curatePauseMs: number;
  skipSyncInNewsRefresh: boolean;
  customRssUrls: string[];
  useGoogleNewsRss: boolean;
  /** Шаблон запроса `{label}` или URL с `{query}` (encoded) */
  rssSearchTemplate: string;
  maxRssItemsPerTopic: number;
}

export interface ResolvedNewsSettings extends NewsSettings {
  source: 'db' | 'env';
}
