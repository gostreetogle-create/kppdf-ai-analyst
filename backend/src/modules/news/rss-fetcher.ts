import Parser from 'rss-parser';
import { config } from '../../config';
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

function buildGoogleNewsUrl(query: string): string {
  const q = encodeURIComponent(`${query} новости`);
  return `https://news.google.com/rss/search?q=${q}&hl=ru&gl=RU&ceid=RU:ru`;
}

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

export async function fetchRssForTopic(topicLabel: string): Promise<RssItem[]> {
  const feedUrl = buildGoogleNewsUrl(topicLabel);
  console.log('[news] RSS fetch', topicLabel);

  try {
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
  } catch (err) {
    console.warn('[news] RSS failed for', topicLabel, err instanceof Error ? err.message : err);
    return [];
  }
}

export async function fetchRssForTopics(
  topicLabels: string[],
  pauseMs = config.news.rssPauseMs,
): Promise<RssItem[]> {
  const all: RssItem[] = [];

  for (let i = 0; i < topicLabels.length; i++) {
    const items = await fetchRssForTopic(topicLabels[i]!);
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

export const rssFetcher = { fetchRssForTopic, fetchRssForTopics, dedupByUrl };
