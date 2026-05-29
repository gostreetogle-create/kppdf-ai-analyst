import { Schema, model, Document } from 'mongoose';

export const APP_SETTINGS_KEY = 'default';

export interface AppSettingsDoc extends Document {
  key: string;
  embedModel: string;
  chatModel: string;
  curateModel: string;
}

const appSettingsSchema = new Schema<AppSettingsDoc>(
  {
    key: { type: String, required: true, unique: true, default: APP_SETTINGS_KEY },
    embedModel: { type: String, required: true },
    chatModel: { type: String, required: true },
    curateModel: { type: String, required: true },
  },
  { timestamps: true },
);

export const AppSettingsModel = model<AppSettingsDoc>('AppSettings', appSettingsSchema);
