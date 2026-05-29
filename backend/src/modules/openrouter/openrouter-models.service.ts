const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const CACHE_TTL_MS = 15 * 60 * 1000;

export interface OpenRouterModelInfo {
  id: string;
  name: string;
  contextLength: number | null;
}

interface ModelsListResponse {
  data: Array<{
    id: string;
    name: string;
    context_length?: number | null;
  }>;
}

interface CacheEntry {
  models: OpenRouterModelInfo[];
  fetchedAt: number;
}

let chatCache: CacheEntry | null = null;
let embedCache: CacheEntry | null = null;

function isFresh(entry: CacheEntry | null): entry is CacheEntry {
  return entry != null && Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

function mapModels(data: ModelsListResponse['data']): OpenRouterModelInfo[] {
  return data
    .map((m) => ({
      id: m.id,
      name: m.name,
      contextLength: m.context_length ?? null,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function fetchModelsList(path: string): Promise<OpenRouterModelInfo[]> {
  const res = await fetch(`${OPENROUTER_BASE}${path}`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[openrouter] GET ${path} failed ${res.status}: ${text}`);
  }

  const json = (await res.json()) as ModelsListResponse;
  if (!Array.isArray(json.data)) {
    throw new Error(`[openrouter] GET ${path} returned invalid payload`);
  }

  return mapModels(json.data);
}

export async function listChatModels(forceRefresh = false): Promise<OpenRouterModelInfo[]> {
  if (!forceRefresh && isFresh(chatCache)) {
    return chatCache.models;
  }

  const models = await fetchModelsList('/models');
  chatCache = { models, fetchedAt: Date.now() };
  return models;
}

export async function listEmbedModels(forceRefresh = false): Promise<OpenRouterModelInfo[]> {
  if (!forceRefresh && isFresh(embedCache)) {
    return embedCache.models;
  }

  const models = await fetchModelsList('/embeddings/models');
  embedCache = { models, fetchedAt: Date.now() };
  return models;
}

export async function getModelCatalog(forceRefresh = false): Promise<{
  chat: OpenRouterModelInfo[];
  embed: OpenRouterModelInfo[];
  cachedAt: string;
}> {
  const [chat, embed] = await Promise.all([
    listChatModels(forceRefresh),
    listEmbedModels(forceRefresh),
  ]);

  const fetchedAt = Math.max(chatCache?.fetchedAt ?? 0, embedCache?.fetchedAt ?? 0);

  return {
    chat,
    embed,
    cachedAt: fetchedAt ? new Date(fetchedAt).toISOString() : new Date().toISOString(),
  };
}

export function clearModelCatalogCache(): void {
  chatCache = null;
  embedCache = null;
}

export const openRouterModelsService = {
  listChatModels,
  listEmbedModels,
  getModelCatalog,
  clearModelCatalogCache,
};
