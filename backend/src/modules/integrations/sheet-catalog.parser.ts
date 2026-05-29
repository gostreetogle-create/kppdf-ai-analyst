export interface ProductsSheetRow {
  sku?: string;
  name?: string;
  category?: string;
  subcategory?: string;
  description?: string;
  purpose?: string;
  materials?: string;
  isActive?: boolean;
  raw: Record<string, string>;
}

function indexHeaders(headers: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((h, i) => map.set(h.trim(), i));
  return map;
}

function cell(row: string[], col: Map<string, number>, name: string): string {
  const idx = col.get(name);
  if (idx == null) return '';
  return String(row[idx] ?? '').trim();
}

function parseIsActive(raw: Record<string, string>): boolean | undefined {
  const value = (raw.isActive ?? raw.isactive ?? '').trim().toLowerCase();
  if (!value) return undefined;
  if (['false', '0', 'нет', 'no'].includes(value)) return false;
  if (['true', '1', 'да', 'yes'].includes(value)) return true;
  return undefined;
}

/** Парсинг строк листа ai_analyst_catalog (как kppdf sync-sheet-to-mongo). */
export function parseProductsSheetRows(headers: string[], rows: string[][]): ProductsSheetRow[] {
  const col = indexHeaders(headers);
  const result: ProductsSheetRow[] = [];

  for (const row of rows) {
    const sku = cell(row, col, 'Артикул');
    const name = cell(row, col, 'Наименование');
    if (!sku && !name) continue;

    const raw: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (h) raw[h] = String(row[i] ?? '').trim();
    });

    result.push({
      sku: sku || undefined,
      name: name || undefined,
      category: cell(row, col, 'Категория') || undefined,
      subcategory: cell(row, col, 'Подкатегория') || undefined,
      description: cell(row, col, 'Описание') || undefined,
      purpose: cell(row, col, 'Назначение') || undefined,
      materials: cell(row, col, 'Материалы') || undefined,
      isActive: parseIsActive(raw),
      raw,
    });
  }

  return result;
}

export function activeSheetProducts(rows: ProductsSheetRow[]): ProductsSheetRow[] {
  return rows.filter((row) => {
    if (!row.sku?.trim() || !row.name?.trim()) return false;
    return row.isActive !== false;
  });
}
