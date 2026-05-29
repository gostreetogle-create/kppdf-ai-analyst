import { ensureCollection } from '../../clients/qdrant.client';
import { isGoogleSheetsConfigured, readSheetRange } from '../../clients/google-sheets.client';
import { kppdfClient } from '../../clients/kppdf.client';
import {
  activeSheetProducts,
  parseProductsSheetRows,
  type ProductsSheetRow,
} from '../integrations/sheet-catalog.parser';
import { embed } from '../openrouter/openrouter.service';
import { type KnowledgePayload, upsertKnowledge } from '../qdrant/knowledge.service';
import { resolveCatalogSyncSource, type CatalogSyncSource } from './catalog-sync.util';
import { buildCategoryMap, buildProductEmbedText, categorySlug } from './embed-text.util';
import { buildSheetProductEmbedText, sheetCategorySlug, sheetProductId } from './sheet-embed.util';

const EMBED_BATCH = 32;

export type { CatalogSyncSource };
export { resolveCatalogSyncSource };

export interface SyncCatalogResult {
  productsFetched: number;
  categoriesFetched: number;
  productsIndexed: number;
  source: CatalogSyncSource;
}

export async function loadSheetCatalog(): Promise<ProductsSheetRow[]> {
  const data = await readSheetRange();
  return activeSheetProducts(parseProductsSheetRows(data.headers, data.rows));
}

export async function syncCatalogFromGoogleSheets(): Promise<SyncCatalogResult> {
  console.log('[sync] starting catalog sync from Google Sheets');

  const products = await loadSheetCatalog();
  const categories = new Set(
    products.map((p) => p.category?.trim()).filter((c): c is string => Boolean(c)),
  );

  await ensureCollection();

  let productsIndexed = 0;

  for (let i = 0; i < products.length; i += EMBED_BATCH) {
    const batch = products.slice(i, i + EMBED_BATCH);
    const texts = batch.map((product) => buildSheetProductEmbedText(product));
    const vectors = await embed(texts);

    const points = batch
      .map((product, idx) => {
        const sku = product.sku!.trim();
        const category = product.category?.trim();
        const subcategory = product.subcategory?.trim();
        const text = texts[idx] ?? product.name ?? sku;
        const productId = sheetProductId(sku);

        const payload: KnowledgePayload = {
          source: 'product',
          productId,
          name: product.name ?? sku,
          categoryName: category,
          categorySlug: category ? sheetCategorySlug(category, subcategory) : undefined,
          sku,
          text,
        };

        return {
          productId,
          vector: vectors[idx] ?? [],
          payload,
        };
      })
      .filter((p) => p.vector.length > 0);

    productsIndexed += await upsertKnowledge(points);
  }

  const result: SyncCatalogResult = {
    productsFetched: products.length,
    categoriesFetched: categories.size,
    productsIndexed,
    source: 'google_sheets',
  };

  console.log('[sync] finished (google_sheets)', result);
  return result;
}

async function syncCatalogFromKppdf(): Promise<SyncCatalogResult> {
  console.log('[sync] starting catalog sync from KPPDF');

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
    const points = batch
      .map((product, idx) => {
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
      })
      .filter((p) => p.vector.length > 0);

    productsIndexed += await upsertKnowledge(points);
  }

  const result: SyncCatalogResult = {
    productsFetched: products.length,
    categoriesFetched: categories.length,
    productsIndexed,
    source: 'kppdf',
  };

  console.log('[sync] finished (kppdf)', result);
  return result;
}

export async function syncCatalog(): Promise<SyncCatalogResult> {
  const source = resolveCatalogSyncSource();
  if (source === 'google_sheets') {
    if (!isGoogleSheetsConfigured()) {
      throw new Error('[sync] Google Sheets не настроен (GOOGLE_SHEET_ID + credentials)');
    }
    return syncCatalogFromGoogleSheets();
  }
  return syncCatalogFromKppdf();
}

export const indexerService = {
  syncCatalog,
  syncCatalogFromGoogleSheets,
  syncCatalogFromKppdf,
  loadSheetCatalog,
  resolveCatalogSyncSource,
};
