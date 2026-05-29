import { config } from '../../config';

export type CatalogSyncSource = 'google_sheets' | 'kppdf';

function isGoogleSheetsConfiguredFromConfig(): boolean {
  const sheetId = config.googleSheets.sheetId?.trim();
  if (!sheetId) return false;

  const hasInline = Boolean(
    config.googleSheets.serviceAccountEmail?.trim() && config.googleSheets.privateKey?.trim(),
  );
  const hasKeyFile = Boolean(config.googleSheets.serviceAccountKeyPath?.trim());

  return hasInline || hasKeyFile;
}

export function resolveCatalogSyncSource(): CatalogSyncSource {
  const env = config.catalogSyncSource?.trim().toLowerCase();
  if (env === 'google_sheets' || env === 'sheets') return 'google_sheets';
  if (env === 'kppdf') return 'kppdf';
  return isGoogleSheetsConfiguredFromConfig() ? 'google_sheets' : 'kppdf';
}
