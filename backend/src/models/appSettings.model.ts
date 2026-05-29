import { Schema, model, Document } from 'mongoose';

export const APP_SETTINGS_KEY = 'default';

export interface AppSettingsDoc extends Document {
  key: string;
  embedModel: string;
  chatModel: string;
  curateModel: string;
  newsTopicsLimit?: number;
  newsRssPauseMs?: number;
  newsCurateBatchSize?: number;
  newsCuratePauseMs?: number;
  newsSkipSyncInRefresh?: boolean;
  newsCustomRssUrls?: string[];
  newsUseGoogleNewsRss?: boolean;
  newsRssSearchTemplate?: string;
  newsMaxRssItemsPerTopic?: number;
}

const appSettingsSchema = new Schema<AppSettingsDoc>(
  {
    key: { type: String, required: true, unique: true, default: APP_SETTINGS_KEY },
    embedModel: { type: String, required: true },
    chatModel: { type: String, required: true },
    curateModel: { type: String, required: true },
    newsTopicsLimit: { type: Number },
    newsRssPauseMs: { type: Number },
    newsCurateBatchSize: { type: Number },
    newsCuratePauseMs: { type: Number },
    newsSkipSyncInRefresh: { type: Boolean },
    newsCustomRssUrls: { type: [String], default: [] },
    newsUseGoogleNewsRss: { type: Boolean },
    newsRssSearchTemplate: { type: String },
    newsMaxRssItemsPerTopic: { type: Number },
  },
  { timestamps: true },
);

export const AppSettingsModel = model<AppSettingsDoc>('AppSettings', appSettingsSchema);
