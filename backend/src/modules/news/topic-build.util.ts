import type { KppdfCategory, KppdfProduct } from '../../clients/kppdf.client';
import { slugFromFullPath } from '../../utils/slug';
import { buildCategoryMap } from '../knowledge/embed-text.util';
import type { ProductsSheetRow } from '../integrations/sheet-catalog.parser';
import type { NewsTopic } from './topic-extractor';

export function buildTopicsFromSheetRows(
  rows: ProductsSheetRow[],
  limit: number,
): NewsTopic[] {
  const counts = new Map<string, { label: string; fullPath: string; count: number }>();

  for (const row of rows) {
    if (row.isActive === false || !row.category?.trim()) continue;

    const category = row.category.trim();
    const subcategory = row.subcategory?.trim();
    const key = subcategory ? `${category}/${subcategory}` : category;
    const fullPath = subcategory ? `/${category}/${subcategory}` : `/${category}`;
    const existing = counts.get(key);

    if (existing) {
      existing.count++;
    } else {
      counts.set(key, {
        label: subcategory || category,
        fullPath,
        count: 1,
      });
    }
  }

  const topics: NewsTopic[] = [];

  for (const [, entry] of counts.entries()) {
    topics.push({
      slug: slugFromFullPath(entry.fullPath, entry.label),
      label: entry.label,
      fullPath: entry.fullPath,
      productCount: entry.count,
    });
  }

  return topics.sort((a, b) => b.productCount - a.productCount).slice(0, limit);
}

export function buildTopicsFromCatalog(
  products: KppdfProduct[],
  categories: KppdfCategory[],
  limit: number,
): NewsTopic[] {
  const categoryMap = buildCategoryMap(categories);
  const counts = new Map<string, number>();

  for (const product of products) {
    if (!product.categoryId) continue;
    counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1);
  }

  const topics: NewsTopic[] = [];

  for (const [categoryId, productCount] of counts.entries()) {
    const category = categoryMap.get(categoryId);
    if (!category) continue;

    const fullPath = category.fullPath || `/${category.name}`;
    topics.push({
      slug: slugFromFullPath(category.fullPath, category.name),
      label: category.name,
      fullPath,
      productCount,
    });
  }

  return topics.sort((a, b) => b.productCount - a.productCount).slice(0, limit);
}
