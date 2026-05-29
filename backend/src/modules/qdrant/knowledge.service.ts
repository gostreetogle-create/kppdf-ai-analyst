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

  await qdrant.upsert(config.qdrant.collection, { wait: true, points });
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

export const knowledgeQdrantService = { upsertKnowledge, searchKnowledge };
