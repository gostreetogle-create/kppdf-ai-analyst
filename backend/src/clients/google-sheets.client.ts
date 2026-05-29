import fs from 'fs';
import path from 'path';
import { google, type sheets_v4 } from 'googleapis';
import { config } from '../config';
import { resolveCatalogSyncSource } from '../modules/knowledge/catalog-sync.util';

const SPREADSHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

/** Заголовки тестового листа ai_analyst_catalog (без KPPDF). */
export const CATALOG_HEADERS = [
  'Артикул',
  'Наименование',
  'Категория',
  'Подкатегория',
  'Описание',
  'Назначение',
  'Материалы',
  'isActive',
] as const;

let cachedClient: sheets_v4.Sheets | null = null;

function resolvePrivateKey(): string | null {
  const inline = config.googleSheets.privateKey?.replace(/\\n/g, '\n').trim();
  if (inline) return inline;

  const keyPath = config.googleSheets.serviceAccountKeyPath?.trim();
  if (!keyPath) return null;

  const abs = path.isAbsolute(keyPath) ? keyPath : path.resolve(process.cwd(), keyPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`[sheets] GOOGLE_SERVICE_ACCOUNT_KEY file not found: ${abs}`);
  }

  const json = JSON.parse(fs.readFileSync(abs, 'utf8')) as {
    client_email?: string;
    private_key?: string;
  };
  return json.private_key?.replace(/\\n/g, '\n') ?? null;
}

function resolveServiceEmail(): string | null {
  const email = config.googleSheets.serviceAccountEmail?.trim();
  if (email) return email;

  const keyPath = config.googleSheets.serviceAccountKeyPath?.trim();
  if (!keyPath) return null;

  const abs = path.isAbsolute(keyPath) ? keyPath : path.resolve(process.cwd(), keyPath);
  if (!fs.existsSync(abs)) return null;

  const json = JSON.parse(fs.readFileSync(abs, 'utf8')) as { client_email?: string };
  return json.client_email?.trim() ?? null;
}

export function isGoogleSheetsConfigured(): boolean {
  const sheetId = config.googleSheets.sheetId?.trim();
  if (!sheetId) return false;

  const hasInline = Boolean(
    config.googleSheets.serviceAccountEmail?.trim() && config.googleSheets.privateKey?.trim(),
  );
  const hasKeyFile = Boolean(config.googleSheets.serviceAccountKeyPath?.trim());

  return hasInline || hasKeyFile;
}

export async function getGoogleSheetsClient(): Promise<sheets_v4.Sheets> {
  if (cachedClient) return cachedClient;

  const sheetId = config.googleSheets.sheetId?.trim();
  if (!sheetId) {
    throw new Error('[sheets] GOOGLE_SHEET_ID is not configured');
  }

  const keyPath = config.googleSheets.serviceAccountKeyPath?.trim();
  if (keyPath) {
    const abs = path.isAbsolute(keyPath) ? keyPath : path.resolve(process.cwd(), keyPath);
    const auth = new google.auth.GoogleAuth({
      keyFile: abs,
      scopes: [SPREADSHEETS_SCOPE],
    });
    cachedClient = google.sheets({ version: 'v4', auth });
    return cachedClient;
  }

  const email = resolveServiceEmail();
  const privateKey = resolvePrivateKey();
  if (!email || !privateKey) {
    throw new Error(
      '[sheets] Configure GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY or GOOGLE_SERVICE_ACCOUNT_KEY',
    );
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: [SPREADSHEETS_SCOPE],
  });
  await auth.authorize();
  cachedClient = google.sheets({ version: 'v4', auth });
  return cachedClient;
}

export function getGoogleSheetsPublicConfig() {
  const email = resolveServiceEmail();
  return {
    sheetId: config.googleSheets.sheetId || '',
    productsRange: config.googleSheets.productsRange,
    catalogRange: config.googleSheets.catalogRange,
    catalogSheetName: config.googleSheets.catalogSheetName,
    catalogSyncSource: resolveCatalogSyncSource(),
    catalogHeaders: [...CATALOG_HEADERS],
    serviceAccountEmail: email || config.googleSheets.serviceAccountEmail || '',
    credentialsConfigured: isGoogleSheetsConfigured(),
    authMode: config.googleSheets.serviceAccountKeyPath?.trim()
      ? 'keyFile'
      : config.googleSheets.serviceAccountEmail?.trim()
        ? 'env'
        : 'none',
    readOnly: false,
    note: 'Тестовый каталог: лист ai_analyst_catalog (без KPPDF). Credentials из kppdf products_import_export.',
  };
}

export interface SheetReadResult {
  range: string;
  rowCount: number;
  headers: string[];
  rows: string[][];
}

function defaultCatalogRange(): string {
  return config.googleSheets.catalogRange;
}

export async function readSheetRange(range?: string): Promise<SheetReadResult> {
  const sheets = await getGoogleSheetsClient();
  const sheetId = config.googleSheets.sheetId!.trim();
  const resolvedRange = range?.trim() || defaultCatalogRange();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: resolvedRange,
  });

  const table = (response.data.values || []) as string[][];
  const headers = (table[0] || []).map((h) => String(h || '').trim());
  const rows = table.slice(1).map((row) => row.map((c) => String(c ?? '')));

  return {
    range: resolvedRange,
    rowCount: rows.length,
    headers,
    rows,
  };
}

export async function testGoogleSheetsConnection(): Promise<{
  ok: boolean;
  spreadsheetTitle?: string;
  range: string;
  rowCount: number;
  headers: string[];
  sampleRows: string[][];
  error?: string;
}> {
  const range = defaultCatalogRange();
  try {
    const sheets = await getGoogleSheetsClient();
    const sheetId = config.googleSheets.sheetId!.trim();

    const meta = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      fields: 'properties.title',
    });

    const data = await readSheetRange(range);
    return {
      ok: true,
      spreadsheetTitle: meta.data.properties?.title ?? undefined,
      range: data.range,
      rowCount: data.rowCount,
      headers: data.headers,
      sampleRows: data.rows.slice(0, 5),
    };
  } catch (err) {
    return {
      ok: false,
      range,
      rowCount: 0,
      headers: [],
      sampleRows: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface InitCatalogSheetResult {
  ok: boolean;
  created: boolean;
  sheetTitle: string;
  headers: string[];
  range: string;
  message: string;
  error?: string;
}

/** Создаёт лист ai_analyst_catalog и записывает строку заголовков (idempotent). */
export async function initCatalogTestSheet(): Promise<InitCatalogSheetResult> {
  const sheetId = config.googleSheets.sheetId!.trim();
  const sheetTitle = config.googleSheets.catalogSheetName;
  const range = defaultCatalogRange();
  const headerRange = `${sheetTitle}!A1:${columnLetter(CATALOG_HEADERS.length)}1`;

  try {
    const sheets = await getGoogleSheetsClient();

    const meta = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      fields: 'sheets.properties.title,sheets.properties.sheetId',
    });

    const existing = meta.data.sheets?.find((s) => s.properties?.title === sheetTitle);
    let created = false;

    if (!existing?.properties?.sheetId) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: sheetTitle } } }],
        },
      });
      created = true;
      console.log(`[sheets] created tab "${sheetTitle}"`);
    }

    const current = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: headerRange,
    });
    const currentHeaders = ((current.data.values?.[0] || []) as string[]).map((h) =>
      String(h || '').trim(),
    );
    const headersMatch =
      currentHeaders.length >= 2 &&
      currentHeaders[0] === CATALOG_HEADERS[0] &&
      currentHeaders[1] === CATALOG_HEADERS[1];

    if (!headersMatch) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: headerRange,
        valueInputOption: 'RAW',
        requestBody: { values: [[...CATALOG_HEADERS]] },
      });
      console.log(`[sheets] wrote headers on "${sheetTitle}"`);
    }

    return {
      ok: true,
      created,
      sheetTitle,
      headers: [...CATALOG_HEADERS],
      range,
      message: created
        ? `Лист «${sheetTitle}» создан, заголовки записаны.`
        : headersMatch
          ? `Лист «${sheetTitle}» уже существует, заголовки на месте.`
          : `Лист «${sheetTitle}» уже существует, заголовки обновлены.`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[sheets] init catalog failed:', message);
    return {
      ok: false,
      created: false,
      sheetTitle,
      headers: [...CATALOG_HEADERS],
      range,
      message: 'Не удалось создать лист',
      error: message,
    };
  }
}

function columnLetter(n: number): string {
  let result = '';
  let num = n;
  while (num > 0) {
    const rem = (num - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}

/** Сброс кэша клиента (после смены .env при dev). */
export function resetGoogleSheetsClient(): void {
  cachedClient = null;
}

export const googleSheetsClient = {
  isGoogleSheetsConfigured,
  getGoogleSheetsClient,
  getGoogleSheetsPublicConfig,
  readSheetRange,
  testGoogleSheetsConnection,
  initCatalogTestSheet,
  resetGoogleSheetsClient,
  CATALOG_HEADERS,
};
