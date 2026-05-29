import type { ChatMessage, CurateNewsInputItem, CuratedNewsItem } from './openrouter.types';
import { resolveDefaultProvider, resolveModels } from '../providers/provider-resolver.service';

async function providerFetch<T>(
  path: string,
  body: unknown,
  apiKey: string,
  baseUrl: string,
): Promise<T> {
  const base = baseUrl.replace(/\/+$/, '');
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

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[openrouter] ${path} failed ${res.status}: ${text}`);
  }

  return (await res.json()) as T;
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

export async function curateNews(items: CurateNewsInputItem[]): Promise<CuratedNewsItem[]> {
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
    console.warn('[openrouter] curateNews invalid JSON, skipping');
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed.filter((item) => {
    if (!item.url || !allowedUrls.has(item.url)) return false;
    const productSet = allowedProductIds.get(item.url);
    if (!productSet) return false;
    item.relatedProductIds = (item.relatedProductIds || []).filter((id) => productSet.has(id));
    return Boolean(item.title && item.summary && item.topicSlug && item.topicLabel);
  });
}

/** Test connection for a specific provider (embed ping). */
export async function testProviderConnection(
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
    return { ok: true, message: 'Подключение успешно (embeddings)' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: msg };
  }
}

export const openRouterService = { embed, chat, curateNews, testProviderConnection };
