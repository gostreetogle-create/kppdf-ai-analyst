import {
  getGoogleSheetsPublicConfig,
  initCatalogTestSheet,
  isGoogleSheetsConfigured,
  readSheetRange,
  testGoogleSheetsConnection,
} from '../../clients/google-sheets.client';
import { syncCatalogFromGoogleSheets } from '../knowledge/indexer.service';
import { parseProductsSheetRows } from './sheet-catalog.parser';

export type { ProductsSheetRow } from './sheet-catalog.parser';
export { parseProductsSheetRows } from './sheet-catalog.parser';

export async function getProductsSheetPreview(limit = 20): Promise<{
  configured: boolean;
  range: string;
  totalDataRows: number;
  parsedCount: number;
  headers: string[];
  items: ReturnType<typeof parseProductsSheetRows>;
}> {
  if (!isGoogleSheetsConfigured()) {
    return {
      configured: false,
      range: '',
      totalDataRows: 0,
      parsedCount: 0,
      headers: [],
      items: [],
    };
  }

  const data = await readSheetRange();
  const parsed = parseProductsSheetRows(data.headers, data.rows);

  return {
    configured: true,
    range: data.range,
    totalDataRows: data.rowCount,
    parsedCount: parsed.length,
    headers: data.headers,
    items: parsed.slice(0, limit),
  };
}

export const googleSheetsIntegration = {
  getSettings: getGoogleSheetsPublicConfig,
  testConnection: testGoogleSheetsConnection,
  initCatalogSheet: initCatalogTestSheet,
  syncCatalog: syncCatalogFromGoogleSheets,
  getProductsPreview: getProductsSheetPreview,
  parseProductsSheetRows,
};
