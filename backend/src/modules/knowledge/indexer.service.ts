import { kppdfClient } from '../../clients/kppdf.client';
import { ensureCollection } from '../../clients/qdrant.client';
import { embed } from '../openrouter/openrouter.service';
import {
  type KnowledgePayload,
  upsertKnowledge,
} from '../qdrant/knowledge.service';
import {
  buildCategoryMap,
  buildProductEmbedText,
  categorySlug,
} from './embed-text.util';

const EMBED_BATCH = 32;

export interface SyncCatalogResult {
  productsFetched: number;
  categoriesFetched: number;
  productsIndexed: number;
}

export async function syncCatalog(): Promise<SyncCatalogResult> {
  console.log('[sync] starting catalog sync');

  const [products, categories] = await Promise.all([
    kppdfClient.getProducts(),
    kppdfClient.getCategories(),
  ]);

  await ensureCollection();
  const categoryMap = buildCategoryMap(categories);

  let productsIndexed = 0;

  for (let i = 0; i < products.length; i += EMBED_BATCH) {
    const batch = products.slice(i, i + EMBED_BATCH);
    const texts = batch.map((product) => {
      const category = product.categoryId ? categoryMap.get(product.categoryId) : undefined;
      return buildProductEmbedText(product, category);
    });

    const vectors = await embed(texts);
    const points = batch.map((product, idx) => {
      const category = product.categoryId ? categoryMap.get(product.categoryId) : undefined;
      const text = texts[idx] ?? product.name;
      const payload: KnowledgePayload = {
        source: 'product',
        productId: product._id,
        name: product.name,
        categoryId: product.categoryId,
        categoryName: category?.name,
        categorySlug: categorySlug(category),
        sku: product.sku,
        text,
      };

      return {
        productId: product._id,
        vector: vectors[idx] ?? [],
        payload,
      };
    }).filter((p) => p.vector.length > 0);

    productsIndexed += await upsertKnowledge(points);
  }

  const result: SyncCatalogResult = {
    productsFetched: products.length,
    categoriesFetched: categories.length,
    productsIndexed,
  };

  console.log('[sync] finished', result);
  return result;
}

export const indexerService = { syncCatalog };
