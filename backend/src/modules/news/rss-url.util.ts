import type { NewsSettings } from './news-settings.types';

const GOOGLE_NEWS_BASE =
  'https://news.google.com/rss/search?q={query}&hl=ru&gl=RU&ceid=RU:ru';

export function newsDefaultsFromConfig(cfg: {
  topicsLimit: number;
  rssPauseMs: number;
  curateBatchSize: number;
  curatePauseMs: number;
  skipSyncInNewsRefresh: boolean;
  maxRssItemsPerTopic: number;
}): NewsSettings {
  return {
    topicsLimit: cfg.topicsLimit,
    rssPauseMs: cfg.rssPauseMs,
    curateBatchSize: cfg.curateBatchSize,
    curatePauseMs: cfg.curatePauseMs,
    skipSyncInNewsRefresh: cfg.skipSyncInNewsRefresh,
    customRssUrls: [],
    useGoogleNewsRss: true,
    rssSearchTemplate: '',
    maxRssItemsPerTopic: cfg.maxRssItemsPerTopic,
  };
}

export function buildTopicRssFeedUrl(topicLabel: string, settings: Pick<NewsSettings, 'useGoogleNewsRss' | 'rssSearchTemplate'>): string | null {
  if (!settings.useGoogleNewsRss) return null;

  const template = settings.rssSearchTemplate?.trim();
  if (template) {
    if (template.startsWith('http://') || template.startsWith('https://')) {
      if (template.includes('{query}')) {
        const q = `${topicLabel} новости`;
        return template.replace('{query}', encodeURIComponent(q));
      }
      return template;
    }
    const queryText = template.replace(/\{label\}/g, topicLabel).replace(/\{query\}/g, `${topicLabel} новости`);
    const encoded = encodeURIComponent(queryText);
    return GOOGLE_NEWS_BASE.replace('{query}', encoded);
  }

  const q = encodeURIComponent(`${topicLabel} новости`);
  return GOOGLE_NEWS_BASE.replace('{query}', q);
}

export function validateRssUrl(url: string): { ok: true } | { ok: false; message: string } {
  const trimmed = url.trim();
  if (!trimmed) {
    return { ok: false, message: 'Пустой URL' };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, message: `Некорректный URL: ${trimmed}` };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, message: `Только http/https: ${trimmed}` };
  }
  return { ok: true };
}

export function validateRssUrls(urls: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const url of urls) {
    const r = validateRssUrl(url);
    if (!r.ok) errors.push(r.message);
  }
  return { valid: errors.length === 0, errors };
}

export function parseCustomRssUrlsText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}
