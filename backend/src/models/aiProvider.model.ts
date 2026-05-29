import { Schema, model, Document, Types } from 'mongoose';

export type AiProviderType = 'openrouter' | 'openai' | 'anthropic' | 'google' | 'custom';

export interface AiProviderDoc extends Document {
  name: string;
  type: AiProviderType;
  baseUrl: string;
  encryptedApiKey: string;
  isActive: boolean;
  isDefault: boolean;
}

const aiProviderSchema = new Schema<AiProviderDoc>(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: ['openrouter', 'openai', 'anthropic', 'google', 'custom'],
    },
    baseUrl: { type: String, required: true, trim: true },
    encryptedApiKey: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

aiProviderSchema.index({ isDefault: 1, isActive: 1 });

export const AiProviderModel = model<AiProviderDoc>('AiProvider', aiProviderSchema);

export type AiProviderId = Types.ObjectId;
