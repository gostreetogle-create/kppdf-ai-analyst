import { getQdrantClient } from '../../clients/qdrant.client';
import { config } from '../../config';
import { productPointId } from '../../utils/point-id';

export interface KnowledgePayload {
  source: 'product';
  productId: string;
  name: string;
  categoryId?: string;
  categoryName?: string;
  categorySlug?: string;
  sku?: string;
  text: string;
}

export interface KnowledgeSearchHit {
  productId: string;
  name: string;
  categoryId?: string;
  categoryName?: string;
  categorySlug?: string;
  score: number;
}

const PRODUCT_FILTER = {
  must: [{ key: 'source', match: { value: 'product' } }],
};

export async function upsertKnowledge(
  items: Array<{ productId: string; vector: number[]; payload: KnowledgePayload }>,
): Promise<number> {
  if (items.length === 0) return 0;

  const qdrant = getQdrantClient();
  const points = items.map((item) => ({
    id: productPointId(item.productId),
    vector: item.vector,
    payload: item.payload as unknown as Record<string, unknown>,
  }));

  try {
    await qdrant.upsert(config.qdrant.collection, { wait: true, points });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const dim = items[0]?.vector.length;
    if (msg === 'Bad Request' || msg.includes('dimension')) {
      throw new Error(
        `[qdrant] upsert failed: vector dim=${dim}, QDRANT_VECTOR_SIZE=${config.qdrant.vectorSize}. ` +
          'Проверьте QDRANT_VECTOR_SIZE в .env (2048 для nvidia/llama-nemotron-embed-vl-1b-v2:free).',
      );
    }
    throw err;
  }
  return points.length;
}

export async function searchKnowledge(
  vector: number[],
  limit = 5,
): Promise<KnowledgeSearchHit[]> {
  const qdrant = getQdrantClient();
  const result = await qdrant.search(config.qdrant.collection, {
    vector,
    limit,
    filter: PRODUCT_FILTER,
    with_payload: true,
  });

  return result.map((hit) => {
    const payload = (hit.payload || {}) as Record<string, unknown>;
    return {
      productId: String(payload.productId ?? ''),
      name: String(payload.name ?? ''),
      categoryId: payload.categoryId ? String(payload.categoryId) : undefined,
      categoryName: payload.categoryName ? String(payload.categoryName) : undefined,
      categorySlug: payload.categorySlug ? String(payload.categorySlug) : undefined,
      score: hit.score ?? 0,
    };
  }).filter((hit) => hit.productId);
}

export async function countProducts(): Promise<number> {
  const qdrant = getQdrantClient();
  const result = await qdrant.count(config.qdrant.collection, {
    exact: true,
    filter: PRODUCT_FILTER,
  });
  return result.count ?? 0;
}

export const knowledgeQdrantService = { upsertKnowledge, searchKnowledge, countProducts };
