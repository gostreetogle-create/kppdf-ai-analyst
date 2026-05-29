import type { ProductsSheetRow } from '../integrations/sheet-catalog.parser';
import { slugFromFullPath } from '../../utils/slug';

/** Текст для embedding из строки Google Sheets. */
export function buildSheetProductEmbedText(row: ProductsSheetRow): string {
  const parts = [
    row.name,
    row.category ? `Категория: ${row.category}` : undefined,
    row.subcategory ? `Подкатегория: ${row.subcategory}` : undefined,
    row.sku ? `Артикул: ${row.sku}` : undefined,
    row.purpose ? `Назначение: ${row.purpose}` : undefined,
    row.materials ? `Материалы: ${row.materials}` : undefined,
    row.description,
  ];

  return parts.filter(Boolean).join('. ');
}

/** Стабильный productId для Qdrant из артикула листа. */
export function sheetProductId(sku: string): string {
  return `sheet:${sku.trim()}`;
}

export function sheetCategorySlug(category: string, subcategory?: string): string {
  const fullPath = subcategory ? `/${category}/${subcategory}` : `/${category}`;
  return slugFromFullPath(fullPath, category);
}
