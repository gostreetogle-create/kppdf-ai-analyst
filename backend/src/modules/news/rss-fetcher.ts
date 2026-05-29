import Parser from 'rss-parser';
import type { NewsSettings } from './news-settings.types';
import { buildTopicRssFeedUrl } from './rss-url.util';
import { sleep } from '../../utils/http';

export interface RssItem {
  url: string;
  title: string;
  sourceName?: string;
  publishedAt?: Date;
  snippet?: string;
}

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'kppdf-ai-analyst/0.1 (+https://kppdf.ru)',
  },
});

function extractSourceName(item: Parser.Item): string | undefined {
  const raw = item as Parser.Item & { source?: { title?: string } | string };
  if (raw.source && typeof raw.source === 'object' && 'title' in raw.source) {
    return String(raw.source.title);
  }
  if (typeof raw.source === 'string') {
    return raw.source;
  }
  return undefined;
}

function limitItems<T>(items: T[], max?: number): T[] {
  if (!max || max <= 0) return items;
  return items.slice(0, max);
}

async function parseFeedUrl(feedUrl: string): Promise<RssItem[]> {
  const feed = await parser.parseURL(feedUrl);
  const items: RssItem[] = [];

  for (const item of feed.items ?? []) {
    const url = item.link?.trim();
    const title = item.title?.trim();
    if (!url || !title) continue;

    const publishedAt = item.pubDate ? new Date(item.pubDate) : undefined;
    items.push({
      url,
      title,
      sourceName: extractSourceName(item),
      publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : undefined,
      snippet: item.contentSnippet?.trim() || item.content?.trim(),
    });
  }

  return items;
}

export async function fetchRssFromUrl(
  feedUrl: string,
  maxItems?: number,
): Promise<RssItem[]> {
  try {
    const items = await parseFeedUrl(feedUrl);
    return limitItems(items, maxItems);
  } catch (err) {
    console.warn('[news] RSS failed for', feedUrl, err instanceof Error ? err.message : err);
    return [];
  }
}

export async function fetchRssForTopic(
  topicLabel: string,
  settings: Pick<NewsSettings, 'useGoogleNewsRss' | 'rssSearchTemplate' | 'maxRssItemsPerTopic'>,
): Promise<RssItem[]> {
  const feedUrl = buildTopicRssFeedUrl(topicLabel, settings);
  if (!feedUrl) return [];

  console.log('[news] RSS fetch', topicLabel);
  return fetchRssFromUrl(feedUrl, settings.maxRssItemsPerTopic);
}

export async function fetchCustomRssFeeds(
  urls: string[],
  maxItems?: number,
  pauseMs = 0,
): Promise<RssItem[]> {
  const all: RssItem[] = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]!;
    console.log('[news] RSS custom', url);
    const items = await fetchRssFromUrl(url, maxItems);
    all.push(...items);
    if (i < urls.length - 1 && pauseMs > 0) {
      await sleep(pauseMs);
    }
  }

  return all;
}

export async function fetchRssForTopics(
  topicLabels: string[],
  settings: Pick<
    NewsSettings,
    'useGoogleNewsRss' | 'rssSearchTemplate' | 'maxRssItemsPerTopic' | 'rssPauseMs'
  >,
): Promise<RssItem[]> {
  const all: RssItem[] = [];
  const pauseMs = settings.rssPauseMs;

  for (let i = 0; i < topicLabels.length; i++) {
    const items = await fetchRssForTopic(topicLabels[i]!, settings);
    all.push(...items);
    if (i < topicLabels.length - 1 && pauseMs > 0) {
      await sleep(pauseMs);
    }
  }

  return all;
}

export function dedupByUrl<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    result.push(item);
  }

  return result;
}

export const rssFetcher = {
  fetchRssForTopic,
  fetchRssFromUrl,
  fetchCustomRssFeeds,
  fetchRssForTopics,
  dedupByUrl,
};
