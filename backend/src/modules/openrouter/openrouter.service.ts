import type { ChatMessage, CurateNewsInputItem, CuratedNewsItem } from './openrouter.types';
import { resolveDefaultProvider, resolveModels } from '../providers/provider-resolver.service';
import { filterCuratedNewsItems } from '../news/curate-filter.util';
import { sleep } from '../../utils/http';
import type { NewsSettings } from '../news/news-settings.types';
import { resolveNewsSettings } from '../news/news-settings-resolver.service';

const MAX_RETRIES = 5;

function parseRetryAfterMs(res: Response, bodyText: string, attempt: number): number {
  const header = res.headers.get('Retry-After');
  if (header) {
    const sec = parseFloat(header);
    if (!Number.isNaN(sec) && sec > 0) {
      return Math.min(Math.max(Math.ceil(sec * 1000), 1000), 60_000);
    }
  }

  try {
    const json = JSON.parse(bodyText) as {
      error?: { metadata?: { retry_after_seconds?: number } };
    };
    const sec = json.error?.metadata?.retry_after_seconds;
    if (typeof sec === 'number' && sec > 0) {
      return Math.min(Math.max(Math.ceil(sec * 1000), 1000), 60_000);
    }
  } catch {
    // ignore invalid JSON
  }

  return Math.min(5000 * (attempt + 1), 30_000);
}

async function providerFetch<T>(
  path: string,
  body: unknown,
  apiKey: string,
  baseUrl: string,
): Promise<T> {
  const base = baseUrl.replace(/\/+$/, '');

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://kppdf.ru',
        'X-Title': 'kppdf-ai-analyst',
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      return (await res.json()) as T;
    }

    const text = await res.text();
    const retryable = res.status === 429 || res.status === 503;

    if (retryable && attempt < MAX_RETRIES) {
      const waitMs = parseRetryAfterMs(res, text, attempt);
      console.warn(
        `[openrouter] ${path} ${res.status}, retry ${attempt + 1}/${MAX_RETRIES} in ${waitMs}ms`,
      );
      await sleep(waitMs);
      continue;
    }

    throw new Error(`[openrouter] ${path} failed ${res.status}: ${text}`);
  }

  throw new Error(`[openrouter] ${path} failed after ${MAX_RETRIES} retries`);
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const provider = await resolveDefaultProvider();
  const models = await resolveModels();

  const response = await providerFetch<{
    data: Array<{ embedding: number[]; index: number }>;
  }>('/embeddings', { model: models.embedModel, input: texts }, provider.apiKey, provider.baseUrl);

  return response.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

export async function chat(messages: ChatMessage[], modelOverride?: string): Promise<string> {
  const provider = await resolveDefaultProvider();
  const models = await resolveModels();
  const model = modelOverride || models.chatModel;

  const response = await providerFetch<{
    choices: Array<{ message: { content: string } }>;
  }>(
    '/chat/completions',
    { model, messages, temperature: 0.2 },
    provider.apiKey,
    provider.baseUrl,
  );

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('[openrouter] chat returned empty content');
  }
  return content;
}

const CURATE_SYSTEM = `Ты редактор новостной ленты для B2B-каталога промышленных товаров KPPDF.
Выбери релевантные новости из списка кандидатов и подготовь краткие анонсы на русском.

Правила:
- Используй ТОЛЬКО URL из входного списка — не выдумывай ссылки.
- relatedProductIds — только id из relatedProducts каждого кандидата.
- summary — 1–3 предложения, деловой стиль.
- Если новость нерелевантна теме каталога — пропусти её.
- Ответ — строго JSON-массив без markdown.`;

export async function curateNews(
  items: CurateNewsInputItem[],
  newsSettings?: Pick<NewsSettings, 'curateBatchSize' | 'curatePauseMs'>,
): Promise<CuratedNewsItem[]> {
  if (items.length === 0) return [];

  const resolved = newsSettings ?? (await resolveNewsSettings());
  const batchSize = Math.max(1, resolved.curateBatchSize);
  const pauseMs = resolved.curatePauseMs;
  const results: CuratedNewsItem[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const part = await curateNewsBatch(batch);
    results.push(...part);

    if (i + batchSize < items.length && pauseMs > 0) {
      await sleep(pauseMs);
    }
  }

  return results;
}

async function curateNewsBatch(items: CurateNewsInputItem[]): Promise<CuratedNewsItem[]> {
  if (items.length === 0) return [];

  const models = await resolveModels();

  const allowedUrls = new Set(items.map((i) => i.url));
  const allowedProductIds = new Map<string, Set<string>>();
  for (const item of items) {
    allowedProductIds.set(
      item.url,
      new Set(item.relatedProducts.map((p) => p.productId)),
    );
  }

  const payload = items.map((item) => ({
    url: item.url,
    title: item.title,
    sourceName: item.sourceName,
    publishedAt: item.publishedAt,
    snippet: item.snippet,
    topicSlug: item.topicSlug,
    topicLabel: item.topicLabel,
    relatedProducts: item.relatedProducts,
  }));

  const raw = await chat(
    [
      { role: 'system', content: CURATE_SYSTEM },
      {
        role: 'user',
        content: `Кандидаты:\n${JSON.stringify(payload, null, 2)}\n\nВерни JSON-массив объектов: { url, title, summary, sourceName?, publishedAt?, topicSlug, topicLabel, relatedProductIds[] }`,
      },
    ],
    models.curateModel,
  );

  const jsonText = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  let parsed: CuratedNewsItem[];
  try {
    parsed = JSON.parse(jsonText) as CuratedNewsItem[];
  } catch {
    console.warn('[openrouter] curateNews invalid JSON, skipping batch');
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return filterCuratedNewsItems(parsed, allowedUrls, allowedProductIds);
}

/** Test connection for a specific provider (embed ping). */
export async function testProviderConnection(
  apiKey: string,
  baseUrl: string,
  embedModel: string,
): Promise<{ ok: boolean; message: string }> {
  const result = await testEmbedModel(apiKey, baseUrl, embedModel);
  return { ok: result.ok, message: result.message };
}

async function testEmbedModel(
  apiKey: string,
  baseUrl: string,
  embedModel: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    await providerFetch<{ data: unknown[] }>(
      '/embeddings',
      { model: embedModel, input: ['ping'] },
      apiKey,
      baseUrl,
    );
    return { ok: true, message: 'Эмбеддинги: OK' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `Эмбеддинги: ${msg}` };
  }
}

async function testChatModel(
  apiKey: string,
  baseUrl: string,
  chatModel: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    await providerFetch<{ choices: unknown[] }>(
      '/chat/completions',
      {
        model: chatModel,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        temperature: 0,
      },
      apiKey,
      baseUrl,
    );
    return { ok: true, message: 'Чат: OK' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `Чат: ${msg}` };
  }
}

/** Live ping for embed + chat models. */
export async function testModels(
  apiKey: string,
  baseUrl: string,
  embedModel: string,
  chatModel: string,
): Promise<{
  ok: boolean;
  embed: { ok: boolean; message: string };
  chat: { ok: boolean; message: string };
}> {
  const [embed, chat] = await Promise.all([
    testEmbedModel(apiKey, baseUrl, embedModel),
    testChatModel(apiKey, baseUrl, chatModel),
  ]);

  return {
    ok: embed.ok && chat.ok,
    embed,
    chat,
  };
}

export const openRouterService = { embed, chat, curateNews, testProviderConnection, testModels };
