import type { KppdfCategory, KppdfProduct } from '../../clients/kppdf.client';
import { slugFromFullPath } from '../../utils/slug';

export function buildProductEmbedText(
  product: KppdfProduct,
  category?: KppdfCategory,
): string {
  const parts = [
    product.name,
    category?.name ? `Категория: ${category.name}` : undefined,
    category?.fullPath ? `Путь: ${category.fullPath}` : undefined,
    product.sku ? `Артикул: ${product.sku}` : undefined,
    product.subcategory ? `Подкатегория: ${product.subcategory}` : undefined,
    product.purpose ? `Назначение: ${product.purpose}` : undefined,
    product.materials ? `Материалы: ${product.materials}` : undefined,
    product.description,
  ];

  return parts.filter(Boolean).join('. ');
}

export function buildCategoryMap(categories: KppdfCategory[]): Map<string, KppdfCategory> {
  return new Map(categories.map((c) => [c._id, c]));
}

export function categorySlug(category?: KppdfCategory): string | undefined {
  if (!category) return undefined;
  return slugFromFullPath(category.fullPath, category.name);
}
