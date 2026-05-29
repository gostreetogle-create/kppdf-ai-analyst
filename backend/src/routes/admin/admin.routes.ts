import { Router, Request, Response } from 'express';
import { config } from '../../config';
import { signAdminJwt } from '../../utils/jwt';
import { adminJwtAuth, type AdminAuthRequest } from '../../middleware/admin-jwt.middleware';
import { AiProviderModel, type AiProviderType } from '../../models/aiProvider.model';
import { AppSettingsModel, APP_SETTINGS_KEY } from '../../models/appSettings.model';
import { AgentRunModel } from '../../models/agentRun.model';
import { NewsItemModel } from '../../models/newsItem.model';
import { encryptSecret, maskApiKey, decryptSecret } from '../../utils/encryption';
import { isMongoReady } from '../../clients/mongo.client';
import { qdrantHealth } from '../../clients/qdrant.client';
import {
  getOrCreateDefaultSettings,
  resetModelsToEnvDefaults,
  getEnvModelDefaults,
  resolveModels,
  resolveDefaultProvider,
} from '../../modules/providers/provider-resolver.service';
import { testProviderConnection, testModels } from '../../modules/openrouter/openrouter.service';
import { openRouterModelsService } from '../../modules/openrouter/openrouter-models.service';
import {
  buildModelCatalogIds,
  validateModelsAgainstCatalog,
} from '../../modules/openrouter/model-validation.util';
import { scheduler } from '../../jobs/scheduler';
import { countProducts } from '../../modules/qdrant/knowledge.service';
import { googleSheetsIntegration } from '../../modules/integrations/google-sheets.service';
import {
  getEnvNewsDefaults,
  normalizeNewsSettingsInput,
  resolveNewsSettings,
  saveNewsSettings,
} from '../../modules/news/news-settings-resolver.service';

const DEFAULT_BASE_URLS: Record<AiProviderType, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  custom: '',
};

function toProviderJson(doc: {
  _id: { toString(): string };
  name: string;
  type: AiProviderType;
  baseUrl: string;
  encryptedApiKey: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  let maskedKey = '';
  try {
    maskedKey = maskApiKey(decryptSecret(doc.encryptedApiKey));
  } catch {
    maskedKey = '••••••••';
  }
  return {
    id: doc._id.toString(),
    name: doc.name,
    type: doc.type,
    baseUrl: doc.baseUrl,
    apiKeyMasked: maskedKey,
    isActive: doc.isActive,
    isDefault: doc.isDefault,
    createdAt: doc.createdAt?.toISOString(),
    updatedAt: doc.updatedAt?.toISOString(),
  };
}

const router = Router();

router.post('/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username?.trim() || !password) {
    res.status(400).json({ error: 'Укажите логин и пароль' });
    return;
  }
  if (username !== config.admin.username || password !== config.admin.password) {
    res.status(401).json({ error: 'Неверный логин или пароль' });
    return;
  }
  const token = signAdminJwt(username, config.admin.jwtSecret);
  res.json({
    token,
    user: { username },
    expiresInHours: 24,
  });
});

router.use(adminJwtAuth);

router.get('/dashboard', async (_req: AdminAuthRequest, res: Response) => {
  try {
    const [newsCount, lastSync, lastNews] = await Promise.all([
      NewsItemModel.countDocuments({ isActive: true }),
      AgentRunModel.findOne({ type: 'sync' }).sort({ startedAt: -1 }).lean(),
      AgentRunModel.findOne({ type: 'news_refresh' }).sort({ startedAt: -1 }).lean(),
    ]);

    const [mongoOk, qdrantOk, models] = await Promise.all([
      Promise.resolve(isMongoReady()),
      qdrantHealth(),
      resolveModels(),
    ]);

    res.json({
      newsCount,
      lastSyncRun: lastSync
        ? {
            status: lastSync.status,
            startedAt: lastSync.startedAt?.toISOString?.() ?? String(lastSync.startedAt),
            finishedAt: lastSync.finishedAt?.toISOString?.(),
            stats: lastSync.stats,
            error: lastSync.error,
          }
        : null,
      lastNewsRun: lastNews
        ? {
            status: lastNews.status,
            startedAt: lastNews.startedAt?.toISOString?.() ?? String(lastNews.startedAt),
            finishedAt: lastNews.finishedAt?.toISOString?.(),
            stats: lastNews.stats,
            error: lastNews.error,
          }
        : null,
      health: { mongo: mongoOk, qdrant: qdrantOk },
      models: {
        embedModel: models.embedModel,
        chatModel: models.chatModel,
        curateModel: models.curateModel,
        source: models.source,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка загрузки обзора';
    res.status(500).json({ error: message });
  }
});

router.get('/providers', async (_req, res: Response) => {
  const docs = await AiProviderModel.find().sort({ isDefault: -1, name: 1 });
  res.json({ providers: docs.map(toProviderJson) });
});

router.post('/providers', async (req, res: Response) => {
  try {
    const { name, type, baseUrl, apiKey, isActive, isDefault } = req.body as {
      name?: string;
      type?: AiProviderType;
      baseUrl?: string;
      apiKey?: string;
      isActive?: boolean;
      isDefault?: boolean;
    };

    if (!name?.trim() || !type || !apiKey?.trim()) {
      res.status(400).json({ error: 'Укажите название, тип и API-ключ' });
      return;
    }

    const resolvedBase =
      baseUrl?.trim() || DEFAULT_BASE_URLS[type] || DEFAULT_BASE_URLS.openrouter;

    if (isDefault) {
      await AiProviderModel.updateMany({}, { $set: { isDefault: false } });
    }

    const doc = await AiProviderModel.create({
      name: name.trim(),
      type,
      baseUrl: resolvedBase,
      encryptedApiKey: encryptSecret(apiKey.trim()),
      isActive: isActive !== false,
      isDefault: Boolean(isDefault),
    });

    res.status(201).json({ provider: toProviderJson(doc) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка создания';
    res.status(500).json({ error: message });
  }
});

router.put('/providers/:id', async (req, res: Response) => {
  try {
    const doc = await AiProviderModel.findById(req.params.id);
    if (!doc) {
      res.status(404).json({ error: 'Провайдер не найден' });
      return;
    }

    const { name, type, baseUrl, apiKey, isActive, isDefault } = req.body as {
      name?: string;
      type?: AiProviderType;
      baseUrl?: string;
      apiKey?: string;
      isActive?: boolean;
      isDefault?: boolean;
    };

    if (name !== undefined) doc.name = name.trim();
    if (type !== undefined) doc.type = type;
    if (baseUrl !== undefined) doc.baseUrl = baseUrl.trim() || doc.baseUrl;
    if (apiKey?.trim()) doc.encryptedApiKey = encryptSecret(apiKey.trim());
    if (isActive !== undefined) doc.isActive = isActive;
    if (isDefault === true) {
      await AiProviderModel.updateMany({ _id: { $ne: doc._id } }, { $set: { isDefault: false } });
      doc.isDefault = true;
    } else if (isDefault === false) {
      doc.isDefault = false;
    }

    await doc.save();
    res.json({ provider: toProviderJson(doc) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка обновления';
    res.status(500).json({ error: message });
  }
});

router.delete('/providers/:id', async (req, res: Response) => {
  const doc = await AiProviderModel.findByIdAndDelete(req.params.id);
  if (!doc) {
    res.status(404).json({ error: 'Провайдер не найден' });
    return;
  }
  res.json({ ok: true });
});

router.post('/providers/:id/test', async (req, res: Response) => {
  try {
    const doc = await AiProviderModel.findById(req.params.id);
    if (!doc) {
      res.status(404).json({ error: 'Провайдер не найден' });
      return;
    }

    const apiKey = decryptSecret(doc.encryptedApiKey);
    const models = await resolveModels();
    const result = await testProviderConnection(apiKey, doc.baseUrl, models.embedModel);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка теста';
    res.status(500).json({ error: message });
  }
});

router.get('/openrouter/models', async (req, res: Response) => {
  try {
    const kind = String(req.query.kind ?? 'all').toLowerCase();
    const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const catalog = await openRouterModelsService.getModelCatalog(refresh);

    if (kind === 'chat') {
      res.json({ models: catalog.chat, kind: 'chat', cachedAt: catalog.cachedAt });
      return;
    }
    if (kind === 'embed') {
      res.json({ models: catalog.embed, kind: 'embed', cachedAt: catalog.cachedAt });
      return;
    }

    res.json({
      chat: catalog.chat,
      embed: catalog.embed,
      cachedAt: catalog.cachedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка загрузки каталога OpenRouter';
    res.status(502).json({ error: message });
  }
});

router.post('/models/validate', async (req, res: Response) => {
  try {
    const { embedModel, chatModel, curateModel } = req.body as {
      embedModel?: string;
      chatModel?: string;
      curateModel?: string;
    };

    if (!embedModel?.trim() || !chatModel?.trim()) {
      res.status(400).json({ error: 'Поля эмбеддингов и чата обязательны' });
      return;
    }

    const catalog = await openRouterModelsService.getModelCatalog();
    const ids = buildModelCatalogIds(catalog);
    const result = validateModelsAgainstCatalog(
      {
        embedModel: embedModel.trim(),
        chatModel: chatModel.trim(),
        curateModel: curateModel?.trim(),
      },
      ids,
    );

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка проверки моделей';
    res.status(502).json({ error: message });
  }
});

router.post('/models/test', async (req, res: Response) => {
  try {
    const { embedModel, chatModel } = req.body as {
      embedModel?: string;
      chatModel?: string;
    };

    if (!embedModel?.trim() || !chatModel?.trim()) {
      res.status(400).json({ error: 'Поля эмбеддингов и чата обязательны' });
      return;
    }

    const catalog = await openRouterModelsService.getModelCatalog();
    const ids = buildModelCatalogIds(catalog);
    const validation = validateModelsAgainstCatalog(
      { embedModel: embedModel.trim(), chatModel: chatModel.trim() },
      ids,
    );

    if (!validation.valid) {
      res.status(400).json({
        ok: false,
        error: validation.errors.map((e) => e.message).join(' '),
        validation,
      });
      return;
    }

    const provider = await resolveDefaultProvider();
    const result = await testModels(
      provider.apiKey,
      provider.baseUrl,
      embedModel.trim(),
      chatModel.trim(),
    );

    res.status(result.ok ? 200 : 502).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка теста моделей';
    res.status(500).json({ ok: false, error: message });
  }
});

router.get('/settings/models', async (_req, res: Response) => {
  const settings = await getOrCreateDefaultSettings();
  const resolved = await resolveModels();
  const envDefaults = await getEnvModelDefaults();
  res.json({
    settings,
    source: resolved.source,
    envDefaults,
  });
});

router.post('/settings/models/reset', async (_req, res: Response) => {
  const settings = await resetModelsToEnvDefaults();
  res.json({
    settings,
    source: 'db',
    message: 'Модели сброшены к значениям из .env (бесплатные OpenRouter по умолчанию)',
  });
});

router.put('/settings/models', async (req, res: Response) => {
  const { embedModel, chatModel, curateModel } = req.body as {
    embedModel?: string;
    chatModel?: string;
    curateModel?: string;
  };

  if (!embedModel?.trim() || !chatModel?.trim()) {
    res.status(400).json({ error: 'Поля эмбеддингов и чата обязательны' });
    return;
  }

  const trimmed = {
    embedModel: embedModel.trim(),
    chatModel: chatModel.trim(),
    curateModel: curateModel?.trim() || chatModel.trim(),
  };

  try {
    const catalog = await openRouterModelsService.getModelCatalog();
    const ids = buildModelCatalogIds(catalog);
    const validation = validateModelsAgainstCatalog(trimmed, ids);

    if (!validation.valid) {
      res.status(400).json({
        error: validation.errors.map((e) => e.message).join(' '),
        errors: validation.errors,
      });
      return;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Не удалось проверить модели в OpenRouter';
    res.status(502).json({ error: message });
    return;
  }

  const doc = await AppSettingsModel.findOneAndUpdate(
    { key: APP_SETTINGS_KEY },
    {
      $set: trimmed,
      $setOnInsert: { key: APP_SETTINGS_KEY },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  res.json({
    settings: {
      embedModel: doc!.embedModel,
      chatModel: doc!.chatModel,
      curateModel: doc!.curateModel,
    },
  });
});

router.get('/settings/news', async (_req, res: Response) => {
  const resolved = await resolveNewsSettings();
  const envDefaults = getEnvNewsDefaults();
  res.json({
    settings: {
      topicsLimit: resolved.topicsLimit,
      rssPauseMs: resolved.rssPauseMs,
      curateBatchSize: resolved.curateBatchSize,
      curatePauseMs: resolved.curatePauseMs,
      skipSyncInNewsRefresh: resolved.skipSyncInNewsRefresh,
      customRssUrls: resolved.customRssUrls,
      useGoogleNewsRss: resolved.useGoogleNewsRss,
      rssSearchTemplate: resolved.rssSearchTemplate,
      maxRssItemsPerTopic: resolved.maxRssItemsPerTopic,
    },
    source: resolved.source,
    envDefaults,
  });
});

router.put('/settings/news', async (req, res: Response) => {
  try {
    const input = normalizeNewsSettingsInput(req.body as Record<string, unknown>);
    const settings = await saveNewsSettings(input);
    res.json({
      settings,
      source: 'db',
      message: 'Настройки новостей сохранены',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка сохранения';
    res.status(400).json({ error: message });
  }
});

router.get('/settings/kppdf', async (_req, res: Response) => {
  let connectionOk = false;
  let connectionError: string | undefined;

  try {
    const healthUrl = `${config.kppdf.baseUrl.replace(/\/+$/, '')}/health`;
    const r = await fetch(healthUrl, { signal: AbortSignal.timeout(3000) });
    connectionOk = r.ok;
    if (!r.ok) {
      connectionError = `HTTP ${r.status}`;
    }
  } catch (err) {
    connectionError = err instanceof Error ? err.message : String(err);
  }

  res.json({
    baseUrl: config.kppdf.baseUrl,
    username: config.kppdf.username,
    passwordConfigured: Boolean(config.kppdf.password),
    connectionOk,
    connectionError,
    readOnly: true,
    note: 'Только просмотр. Измените KPPDF_API_URL, KPPDF_AUTH_USERNAME, KPPDF_AUTH_PASSWORD в файле .env в корне проекта и перезапустите backend (.\\stop.ps1 → .\\start.cmd). Через админку не редактируется.',
  });
});

router.put('/settings/kppdf', (_req, res: Response) => {
  res.status(400).json({
    error: 'KPPDF настройки только в .env',
    note: 'Обновите KPPDF_API_URL, KPPDF_AUTH_USERNAME, KPPDF_AUTH_PASSWORD в .env и перезапустите сервис.',
  });
});

function serializeAgentRun(r: Record<string, unknown>) {
  const startedAt = r.startedAt;
  const finishedAt = r.finishedAt;
  return {
    id: r._id != null ? String(r._id) : '',
    type: String(r.type ?? 'unknown'),
    status: String(r.status ?? 'unknown'),
    startedAt:
      startedAt instanceof Date
        ? startedAt.toISOString()
        : startedAt != null
          ? String(startedAt)
          : '',
    finishedAt:
      finishedAt instanceof Date
        ? finishedAt.toISOString()
        : finishedAt != null
          ? String(finishedAt)
          : undefined,
    stats: r.stats ?? undefined,
    error: r.error != null ? String(r.error) : undefined,
  };
}

router.get('/runs', async (req, res: Response) => {
  try {
    const parsed = parseInt(String(req.query.limit ?? '50'), 10);
    const limit = Math.min(Number.isFinite(parsed) && parsed > 0 ? parsed : 50, 200);
    const runs = await AgentRunModel.find().sort({ startedAt: -1 }).limit(limit).lean();
    res.json({
      runs: runs.map((r) => serializeAgentRun(r as Record<string, unknown>)),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка загрузки запусков';
    console.error('[admin] GET /runs failed:', err);
    res.status(500).json({ error: message });
  }
});

router.post('/jobs/sync', async (_req, res: Response) => {
  try {
    const result = await scheduler.runSyncJob('manual');
    if (result.status === 'skipped') {
      res.status(200).json(result);
      return;
    }
    const code = result.status === 'success' ? 200 : 500;
    res.status(code).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка синхронизации';
    res.status(500).json({ error: message });
  }
});

router.post('/jobs/news-refresh', async (_req, res: Response) => {
  try {
    const result = await scheduler.runNewsRefreshJob('manual');
    if (result.status === 'skipped') {
      res.status(200).json(result);
      return;
    }
    const code = result.status === 'success' ? 200 : 500;
    res.status(code).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка обновления новостей';
    res.status(500).json({ error: message });
  }
});

router.post('/jobs/recover-stale-runs', async (_req, res: Response) => {
  try {
    const { recoverStaleAgentRuns } = await import('../../jobs/agent-run-recovery');
    const recovered = await recoverStaleAgentRuns(0);
    res.json({ ok: true, recovered });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка восстановления runs';
    res.status(500).json({ error: message });
  }
});

router.get('/news', async (req, res: Response) => {
  try {
    const page = Math.max(parseInt(String(req.query.page ?? '1'), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '20'), 10) || 20, 1), 100);
    const topic = String(req.query.topic ?? req.query.topicSlug ?? '').trim();
    const q = String(req.query.q ?? '').trim();

    const filter: Record<string, unknown> = { isActive: true };
    if (topic) filter.topicSlug = topic;

    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { summary: { $regex: q, $options: 'i' } },
        { sourceName: { $regex: q, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      NewsItemModel.find(filter).sort({ publishedAt: -1 }).skip(skip).limit(limit).lean(),
      NewsItemModel.countDocuments(filter),
    ]);

    res.json({
      data: items.map((item) => ({
        id: String(item._id),
        title: item.title,
        summary: item.summary,
        url: item.url,
        sourceName: item.sourceName,
        publishedAt: item.publishedAt?.toISOString?.() ?? String(item.publishedAt),
        fetchedAt: item.fetchedAt?.toISOString?.() ?? String(item.fetchedAt),
        topicSlug: item.topicSlug,
        topicLabel: item.topicLabel,
        relatedProductIds: item.relatedProductIds,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка загрузки новостей';
    res.status(500).json({ error: message });
  }
});

router.get('/knowledge/stats', async (_req, res: Response) => {
  try {
    const [productCount, lastSync] = await Promise.all([
      countProducts().catch(() => 0),
      AgentRunModel.findOne({ type: 'sync', status: 'success' })
        .sort({ finishedAt: -1 })
        .lean(),
    ]);

    res.json({
      productCount,
      lastSyncAt: lastSync?.finishedAt?.toISOString?.() ?? null,
      lastSyncStatus: lastSync?.status ?? null,
      lastSyncStats: lastSync?.stats ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка статистики знаний';
    res.status(500).json({ error: message });
  }
});

router.get('/settings/google-sheets', (_req, res: Response) => {
  res.json(googleSheetsIntegration.getSettings());
});

router.post('/integrations/google-sheets/test', async (_req, res: Response) => {
  try {
    const result = await googleSheetsIntegration.testConnection();
    res.status(result.ok ? 200 : 502).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка проверки Google Sheets';
    res.status(500).json({ ok: false, error: message });
  }
});

router.post('/integrations/google-sheets/init-catalog-sheet', async (_req, res: Response) => {
  try {
    if (!googleSheetsIntegration.getSettings().credentialsConfigured) {
      res.status(400).json({
        ok: false,
        error: 'Google Sheets не настроен',
        note: 'Заполните GOOGLE_SHEET_ID и credentials в .env',
      });
      return;
    }
    const result = await googleSheetsIntegration.initCatalogSheet();
    res.status(result.ok ? 200 : 502).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка создания листа';
    res.status(500).json({ ok: false, error: message });
  }
});

router.post('/integrations/google-sheets/sync-catalog', async (_req, res: Response) => {
  try {
    if (!googleSheetsIntegration.getSettings().credentialsConfigured) {
      res.status(400).json({
        error: 'Google Sheets не настроен',
        note: 'Заполните GOOGLE_SHEET_ID и credentials в .env',
      });
      return;
    }
    const stats = await googleSheetsIntegration.syncCatalog();
    res.json({ status: 'success', stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка синхронизации каталога';
    res.status(500).json({ status: 'failed', error: message });
  }
});

router.get('/integrations/google-sheets/products-preview', async (req, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10) || 20, 100);
    const preview = await googleSheetsIntegration.getProductsPreview(limit);
    if (!preview.configured) {
      res.status(400).json({
        error: 'Google Sheets не настроен',
        note: 'Заполните GOOGLE_SHEET_ID и credentials в .env',
      });
      return;
    }
    res.json(preview);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка чтения таблицы';
    res.status(502).json({ error: message });
  }
});

export default router;
