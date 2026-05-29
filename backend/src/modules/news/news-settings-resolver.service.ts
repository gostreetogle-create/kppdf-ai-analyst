import { config } from '../../config';
import { AppSettingsModel, APP_SETTINGS_KEY, type AppSettingsDoc } from '../../models/appSettings.model';
import type { NewsSettings, ResolvedNewsSettings } from './news-settings.types';
import { newsDefaultsFromConfig, validateRssUrls } from './rss-url.util';

export function getEnvNewsDefaults(): NewsSettings {
  return newsDefaultsFromConfig(config.news);
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function pickNewsFromDoc(doc: AppSettingsDoc | null): Partial<NewsSettings> | null {
  if (!doc) return null;
  const hasAny =
    doc.newsTopicsLimit != null ||
    doc.newsRssPauseMs != null ||
    doc.newsSkipSyncInRefresh != null ||
    (doc.newsCustomRssUrls?.length ?? 0) > 0 ||
    doc.newsUseGoogleNewsRss != null ||
    doc.newsRssSearchTemplate != null ||
    doc.newsMaxRssItemsPerTopic != null;
  if (!hasAny) return null;

  return {
    topicsLimit: doc.newsTopicsLimit ?? undefined,
    rssPauseMs: doc.newsRssPauseMs ?? undefined,
    curateBatchSize: doc.newsCurateBatchSize ?? undefined,
    curatePauseMs: doc.newsCuratePauseMs ?? undefined,
    skipSyncInNewsRefresh: doc.newsSkipSyncInRefresh ?? undefined,
    customRssUrls: doc.newsCustomRssUrls ?? undefined,
    useGoogleNewsRss: doc.newsUseGoogleNewsRss ?? undefined,
    rssSearchTemplate: doc.newsRssSearchTemplate ?? undefined,
    maxRssItemsPerTopic: doc.newsMaxRssItemsPerTopic ?? undefined,
  };
}

export function mergeNewsSettings(partial: Partial<NewsSettings> | null): ResolvedNewsSettings {
  const env = getEnvNewsDefaults();
  if (!partial) {
    return { ...env, source: 'env' };
  }
  return {
    topicsLimit: partial.topicsLimit ?? env.topicsLimit,
    rssPauseMs: partial.rssPauseMs ?? env.rssPauseMs,
    curateBatchSize: partial.curateBatchSize ?? env.curateBatchSize,
    curatePauseMs: partial.curatePauseMs ?? env.curatePauseMs,
    skipSyncInNewsRefresh: partial.skipSyncInNewsRefresh ?? env.skipSyncInNewsRefresh,
    customRssUrls: partial.customRssUrls ?? env.customRssUrls,
    useGoogleNewsRss: partial.useGoogleNewsRss ?? env.useGoogleNewsRss,
    rssSearchTemplate: partial.rssSearchTemplate ?? env.rssSearchTemplate,
    maxRssItemsPerTopic: partial.maxRssItemsPerTopic ?? env.maxRssItemsPerTopic,
    source: 'db',
  };
}

export async function resolveNewsSettings(): Promise<ResolvedNewsSettings> {
  const doc = await AppSettingsModel.findOne({ key: APP_SETTINGS_KEY }).lean().exec();
  const partial = pickNewsFromDoc(doc as AppSettingsDoc | null);
  return mergeNewsSettings(partial);
}

export function normalizeNewsSettingsInput(body: Record<string, unknown>): NewsSettings {
  const env = getEnvNewsDefaults();
  const customRaw = body.customRssUrls;
  let customRssUrls: string[] = env.customRssUrls;
  if (Array.isArray(customRaw)) {
    customRssUrls = customRaw.map((u) => String(u).trim()).filter(Boolean);
  } else if (typeof body.customRssUrlsText === 'string') {
    customRssUrls = body.customRssUrlsText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  }

  return {
    topicsLimit: clampInt(body.topicsLimit, 1, 50, env.topicsLimit),
    rssPauseMs: clampInt(body.rssPauseMs, 0, 10_000, env.rssPauseMs),
    curateBatchSize: clampInt(body.curateBatchSize, 1, 32, env.curateBatchSize),
    curatePauseMs: clampInt(body.curatePauseMs, 0, 60_000, env.curatePauseMs),
    skipSyncInNewsRefresh: Boolean(body.skipSyncInNewsRefresh),
    customRssUrls,
    useGoogleNewsRss: body.useGoogleNewsRss !== false,
    rssSearchTemplate: typeof body.rssSearchTemplate === 'string' ? body.rssSearchTemplate.trim() : '',
    maxRssItemsPerTopic: clampInt(body.maxRssItemsPerTopic, 1, 100, env.maxRssItemsPerTopic),
  };
}

export async function saveNewsSettings(input: NewsSettings): Promise<NewsSettings> {
  const validation = validateRssUrls(input.customRssUrls);
  if (!validation.valid) {
    throw new Error(validation.errors.join('; '));
  }

  const doc = await AppSettingsModel.findOneAndUpdate(
    { key: APP_SETTINGS_KEY },
    {
      $set: {
        newsTopicsLimit: input.topicsLimit,
        newsRssPauseMs: input.rssPauseMs,
        newsCurateBatchSize: input.curateBatchSize,
        newsCuratePauseMs: input.curatePauseMs,
        newsSkipSyncInRefresh: input.skipSyncInNewsRefresh,
        newsCustomRssUrls: input.customRssUrls,
        newsUseGoogleNewsRss: input.useGoogleNewsRss,
        newsRssSearchTemplate: input.rssSearchTemplate,
        newsMaxRssItemsPerTopic: input.maxRssItemsPerTopic,
      },
      $setOnInsert: {
        key: APP_SETTINGS_KEY,
        embedModel: config.openrouter.embedModel,
        chatModel: config.openrouter.chatModel,
        curateModel: config.openrouter.chatModel,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const resolved = mergeNewsSettings(pickNewsFromDoc(doc));
  const { source: _source, ...settings } = resolved;
  return settings;
}
