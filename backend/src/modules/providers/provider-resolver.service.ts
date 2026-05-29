import { config } from '../../config';
import { AiProviderModel, type AiProviderDoc } from '../../models/aiProvider.model';
import { AppSettingsModel, APP_SETTINGS_KEY } from '../../models/appSettings.model';
import { decryptSecret } from '../../utils/encryption';

const DEFAULT_OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

export interface ResolvedProvider {
  apiKey: string;
  baseUrl: string;
  providerId?: string;
  providerName?: string;
  source: 'db' | 'env';
}

export interface ResolvedModels {
  embedModel: string;
  chatModel: string;
  curateModel: string;
  source: 'db' | 'env';
}

export async function resolveDefaultProvider(): Promise<ResolvedProvider> {
  const doc = await AiProviderModel.findOne({ isDefault: true, isActive: true }).exec();
  if (doc?.encryptedApiKey) {
    try {
      const apiKey = decryptSecret(doc.encryptedApiKey);
      if (apiKey) {
        return {
          apiKey,
          baseUrl: normalizeBaseUrl(doc.baseUrl),
          providerId: doc._id.toString(),
          providerName: doc.name,
          source: 'db',
        };
      }
    } catch (err) {
      console.warn('[providers] decrypt failed, falling back to env:', err instanceof Error ? err.message : err);
    }
  }

  const envKey = config.openrouter.apiKey;
  if (!envKey) {
    throw new Error('[providers] No API key: configure a default provider in admin or set OPENROUTER_API_KEY');
  }

  return {
    apiKey: envKey,
    baseUrl: DEFAULT_OPENROUTER_BASE,
    providerName: 'env (OPENROUTER_API_KEY)',
    source: 'env',
  };
}

export async function resolveProviderById(id: string): Promise<ResolvedProvider & { doc: AiProviderDoc }> {
  const doc = await AiProviderModel.findById(id).exec();
  if (!doc) {
    throw new Error('[providers] Provider not found');
  }
  if (!doc.isActive) {
    throw new Error('[providers] Provider is inactive');
  }
  const apiKey = decryptSecret(doc.encryptedApiKey);
  return {
    apiKey,
    baseUrl: normalizeBaseUrl(doc.baseUrl),
    providerId: doc._id.toString(),
    providerName: doc.name,
    source: 'db',
    doc,
  };
}

export async function resolveModels(): Promise<ResolvedModels> {
  const settings = await AppSettingsModel.findOne({ key: APP_SETTINGS_KEY }).lean().exec();
  if (settings?.embedModel && settings?.chatModel) {
    return {
      embedModel: settings.embedModel,
      chatModel: settings.chatModel,
      curateModel: settings.curateModel || settings.chatModel,
      source: 'db',
    };
  }

  return {
    embedModel: config.openrouter.embedModel,
    chatModel: config.openrouter.chatModel,
    curateModel: config.openrouter.chatModel,
    source: 'env',
  };
}

function normalizeBaseUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, '');
  return trimmed || DEFAULT_OPENROUTER_BASE;
}

export async function getEnvModelDefaults(): Promise<{
  embedModel: string;
  chatModel: string;
  curateModel: string;
}> {
  return {
    embedModel: config.openrouter.embedModel,
    chatModel: config.openrouter.chatModel,
    curateModel: config.openrouter.chatModel,
  };
}

export async function resetModelsToEnvDefaults(): Promise<{
  embedModel: string;
  chatModel: string;
  curateModel: string;
}> {
  const defaults = await getEnvModelDefaults();
  const doc = await AppSettingsModel.findOneAndUpdate(
    { key: APP_SETTINGS_KEY },
    {
      $set: defaults,
      $setOnInsert: { key: APP_SETTINGS_KEY },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return {
    embedModel: doc!.embedModel,
    chatModel: doc!.chatModel,
    curateModel: doc!.curateModel,
  };
}

export async function getOrCreateDefaultSettings(): Promise<{
  embedModel: string;
  chatModel: string;
  curateModel: string;
}> {
  let doc = await AppSettingsModel.findOne({ key: APP_SETTINGS_KEY }).exec();
  if (!doc) {
    doc = await AppSettingsModel.create({
      key: APP_SETTINGS_KEY,
      embedModel: config.openrouter.embedModel,
      chatModel: config.openrouter.chatModel,
      curateModel: config.openrouter.chatModel,
    });
  }
  return {
    embedModel: doc.embedModel,
    chatModel: doc.chatModel,
    curateModel: doc.curateModel,
  };
}
