import { AgentRunModel } from '../../models/agentRun.model';
import { NewsItemModel } from '../../models/newsItem.model';
import { syncCatalog } from '../knowledge/indexer.service';
import { embed, curateNews } from '../openrouter/openrouter.service';
import type { CurateNewsInputItem } from '../openrouter/openrouter.types';
import { searchKnowledge } from '../qdrant/knowledge.service';
import { dedupByUrl, fetchCustomRssFeeds, fetchRssForTopic } from './rss-fetcher';
import { extractTopics, type NewsTopic } from './topic-extractor';
import { resolveNewsSettings } from './news-settings-resolver.service';
import { sleep } from '../../utils/http';

export interface NewsRefreshResult {
  agentRunId: string;
  topicsProcessed: number;
  rssItemsFetched: number;
  rssItemsAfterDedup: number;
  newsCurated: number;
  newsSaved: number;
}

interface TopicRssItem {
  url: string;
  title: string;
  sourceName?: string;
  publishedAt?: Date;
  snippet?: string;
  topicSlug: string;
  topicLabel: string;
}

let refreshInProgress = false;
let refreshStartedAt = 0;

const REFRESH_STALE_MS = 15 * 60 * 1000;

export function isNewsRefreshInProgress(): boolean {
  return refreshInProgress;
}

function acquireRefreshLock(): void {
  if (refreshInProgress) {
    const age = Date.now() - refreshStartedAt;
    if (age < REFRESH_STALE_MS) {
      throw new Error('[news] refresh already in progress');
    }
    console.warn(`[news] stale in-memory lock (${Math.round(age / 1000)}s), starting new refresh`);
  }
  refreshInProgress = true;
  refreshStartedAt = Date.now();
}

function releaseRefreshLock(): void {
  refreshInProgress = false;
  refreshStartedAt = 0;
}

async function ragProductsForTopic(topic: NewsTopic) {
  const query = `${topic.label}. ${topic.fullPath}. промышленность B2B`;
  const [vector] = await embed([query]);
  if (!vector) return [];
  return searchKnowledge(vector, 5);
}

export async function refreshNews(): Promise<NewsRefreshResult> {
  acquireRefreshLock();

  const run = await AgentRunModel.create({
    type: 'news_refresh',
    status: 'running',
    startedAt: new Date(),
  });

  try {
    console.log('[news] refresh started', run._id);

    const settings = await resolveNewsSettings();

    if (!settings.skipSyncInNewsRefresh) {
      await syncCatalog();
    } else {
      console.log('[news] skip catalog sync (admin setting)');
    }

    const topics = await extractTopics(settings.topicsLimit);
    const topicRssItems: TopicRssItem[] = [];
    const ragByTopic = new Map<string, Awaited<ReturnType<typeof ragProductsForTopic>>>();

    if (settings.customRssUrls.length > 0) {
      const customItems = await fetchCustomRssFeeds(
        settings.customRssUrls,
        settings.maxRssItemsPerTopic,
        settings.rssPauseMs,
      );
      for (const item of customItems) {
        topicRssItems.push({
          ...item,
          topicSlug: 'custom',
          topicLabel: 'Пользовательские ленты',
        });
      }
    }

    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i]!;
      const products = await ragProductsForTopic(topic);
      ragByTopic.set(topic.slug, products);

      const rssItems = await fetchRssForTopic(topic.label, settings);

      for (const item of rssItems) {
        topicRssItems.push({
          ...item,
          topicSlug: topic.slug,
          topicLabel: topic.label,
        });
      }

      if (i < topics.length - 1 && settings.rssPauseMs > 0) {
        await sleep(settings.rssPauseMs);
      }
    }

    const rssItemsFetched = topicRssItems.length;
    const deduped = dedupByUrl(topicRssItems);
    const rssItemsAfterDedup = deduped.length;

    const curateInputs: CurateNewsInputItem[] = [];

    for (const item of deduped) {
      const products = ragByTopic.get(item.topicSlug) ?? [];
      curateInputs.push({
        url: item.url,
        title: item.title,
        sourceName: item.sourceName,
        publishedAt: item.publishedAt?.toISOString(),
        snippet: item.snippet,
        topicSlug: item.topicSlug,
        topicLabel: item.topicLabel,
        relatedProducts: products.map((p) => ({ productId: p.productId, name: p.name })),
      });
    }

    const curated = await curateNews(curateInputs, settings);
    const fetchedAt = new Date();
    let newsSaved = 0;

    for (const item of curated) {
      const source = deduped.find((d) => d.url === item.url);
      const publishedAt = item.publishedAt
        ? new Date(item.publishedAt)
        : source?.publishedAt ?? fetchedAt;

      await NewsItemModel.findOneAndUpdate(
        { url: item.url },
        {
          title: item.title,
          summary: item.summary,
          url: item.url,
          sourceName: item.sourceName ?? source?.sourceName,
          publishedAt,
          fetchedAt,
          topicSlug: item.topicSlug,
          topicLabel: item.topicLabel,
          relatedProductIds: item.relatedProductIds,
          agentRunId: String(run._id),
          isActive: true,
        },
        { upsert: true, new: true },
      );
      newsSaved++;
    }

    const result: NewsRefreshResult = {
      agentRunId: String(run._id),
      topicsProcessed: topics.length,
      rssItemsFetched,
      rssItemsAfterDedup,
      newsCurated: curated.length,
      newsSaved,
    };

    run.status = 'success';
    run.finishedAt = new Date();
    run.stats = { ...result };
    await run.save();

    console.log('[news] refresh finished', result);
    return result;
  } catch (err) {
    run.status = 'failed';
    run.finishedAt = new Date();
    run.error = err instanceof Error ? err.message : String(err);
    await run.save();
    console.error('[news] refresh failed', run.error);
    throw err;
  } finally {
    releaseRefreshLock();
  }
}

export const newsAnalystService = { refreshNews, isNewsRefreshInProgress };
