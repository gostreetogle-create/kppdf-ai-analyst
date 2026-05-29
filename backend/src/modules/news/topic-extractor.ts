import { kppdfClient } from '../../clients/kppdf.client';
import { config } from '../../config';
import { slugFromFullPath } from '../../utils/slug';
import { buildCategoryMap } from '../knowledge/embed-text.util';

export interface NewsTopic {
  slug: string;
  label: string;
  fullPath: string;
  productCount: number;
}

export async function extractTopics(limit = config.news.topicsLimit): Promise<NewsTopic[]> {
  const [products, categories] = await Promise.all([
    kppdfClient.getProducts(),
    kppdfClient.getCategories(),
  ]);

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

  return topics
    .sort((a, b) => b.productCount - a.productCount)
    .slice(0, limit);
}

export const topicExtractor = { extractTopics };
