import type { CuratedNewsItem } from '../openrouter/openrouter.types';

export function filterCuratedNewsItems(
  parsed: unknown,
  allowedUrls: Set<string>,
  allowedProductIds: Map<string, Set<string>>,
): CuratedNewsItem[] {
  if (!Array.isArray(parsed)) return [];

  return parsed.filter((item): item is CuratedNewsItem => {
    if (!item || typeof item !== 'object') return false;
    const row = item as CuratedNewsItem;
    if (!row.url || !allowedUrls.has(row.url)) return false;
    const productSet = allowedProductIds.get(row.url);
    if (!productSet) return false;
    row.relatedProductIds = (row.relatedProductIds || []).filter((id) => productSet.has(id));
    return Boolean(row.title && row.summary && row.topicSlug && row.topicLabel);
  });
}
