import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3100', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  apiKey: process.env.AI_SERVICE_API_KEY || 'dev-key-change-me',

  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27018/kppdf_ai',

  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    collection: process.env.QDRANT_COLLECTION || 'kppdf_knowledge',
    // 2048 — nvidia/llama-nemotron-embed-vl-1b-v2:free (default embed)
    vectorSize: parseInt(process.env.QDRANT_VECTOR_SIZE || '2048', 10),
  },

  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    chatModel: process.env.OPENROUTER_MODEL_CHAT || 'meta-llama/llama-3.3-70b-instruct:free',
    // :free embed; paid fallback example: thenlper/gte-base (768-dim, $0.005/1M)
    embedModel:
      process.env.OPENROUTER_MODEL_EMBED || 'nvidia/llama-nemotron-embed-vl-1b-v2:free',
  },

  kppdf: {
    baseUrl: process.env.KPPDF_API_URL || 'http://localhost:3000/api/v1',
    username: process.env.KPPDF_AUTH_USERNAME || '',
    password: process.env.KPPDF_AUTH_PASSWORD || '',
  },

  schedule: {
    syncIntervalHours: parseInt(process.env.SYNC_INTERVAL_HOURS || '12', 10),
    newsRefreshIntervalHours: parseInt(process.env.NEWS_REFRESH_INTERVAL_HOURS || '6', 10),
  },

  news: {
    topicsLimit: parseInt(process.env.NEWS_TOPICS_LIMIT || '15', 10),
    rssPauseMs: parseInt(process.env.NEWS_RSS_PAUSE_MS || '400', 10),
    curateBatchSize: parseInt(process.env.NEWS_CURATE_BATCH_SIZE || '8', 10),
    curatePauseMs: parseInt(process.env.NEWS_CURATE_PAUSE_MS || '2000', 10),
    skipSyncInNewsRefresh: process.env.NEWS_SKIP_SYNC_IN_REFRESH === 'true',
    maxRssItemsPerTopic: parseInt(process.env.NEWS_MAX_RSS_ITEMS_PER_TOPIC || '20', 10),
  },

  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin',
    jwtSecret: process.env.ADMIN_JWT_SECRET || 'change-me-admin-jwt-secret',
    encryptionSecret: process.env.ADMIN_ENCRYPTION_SECRET || '',
  },

  /** google_sheets | kppdf — auto: sheets if GOOGLE credentials set */
  catalogSyncSource: process.env.CATALOG_SYNC_SOURCE || '',

  /** Google Sheets — та же таблица каталога, что kppdf-3.0/tools/products_import_export */
  googleSheets: {
    sheetId: process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SHEETS_ID || '',
    productsRange: process.env.GOOGLE_SHEETS_PRODUCTS_RANGE || 'products!A1:ZZ5000',
    catalogRange: process.env.GOOGLE_SHEETS_CATALOG_RANGE || 'ai_analyst_catalog!A1:Z500',
    catalogSheetName: 'ai_analyst_catalog',
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
    privateKey: process.env.GOOGLE_PRIVATE_KEY || '',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '',
  },
};
