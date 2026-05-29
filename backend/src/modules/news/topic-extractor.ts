import { config } from '../../config';
import { loadSheetCatalog } from '../knowledge/indexer.service';
import { resolveCatalogSyncSource } from '../knowledge/catalog-sync.util';
import { buildTopicsFromCatalog, buildTopicsFromSheetRows } from './topic-build.util';
import { kppdfClient } from '../../clients/kppdf.client';

export interface NewsTopic {
  slug: string;
  label: string;
  fullPath: string;
  productCount: number;
}

export async function extractTopics(limit = config.news.topicsLimit): Promise<NewsTopic[]> {
  if (resolveCatalogSyncSource() === 'google_sheets') {
    const products = await loadSheetCatalog();
    return buildTopicsFromSheetRows(products, limit);
  }

  const [products, categories] = await Promise.all([
    kppdfClient.getProducts(),
    kppdfClient.getCategories(),
  ]);

  return buildTopicsFromCatalog(products, categories, limit);
}

export const topicExtractor = { extractTopics };
