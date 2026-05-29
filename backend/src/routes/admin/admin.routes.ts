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
} from '../../modules/providers/provider-resolver.service';
import { testProviderConnection } from '../../modules/openrouter/openrouter.service';

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

  const doc = await AppSettingsModel.findOneAndUpdate(
    { key: APP_SETTINGS_KEY },
    {
      $set: {
        embedModel: embedModel.trim(),
        chatModel: chatModel.trim(),
        curateModel: curateModel?.trim() || chatModel.trim(),
      },
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

router.get('/settings/kppdf', (_req, res: Response) => {
  res.json({
    baseUrl: config.kppdf.baseUrl,
    username: config.kppdf.username,
    passwordConfigured: Boolean(config.kppdf.password),
    readOnly: true,
    note: 'Только просмотр. Измените KPPDF_API_URL, KPPDF_AUTH_USERNAME, KPPDF_AUTH_PASSWORD в файле .env в корне проекта и перезапустите backend (.\stop.ps1 → .\start.cmd). Через админку не редактируется.',
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

export default router;
