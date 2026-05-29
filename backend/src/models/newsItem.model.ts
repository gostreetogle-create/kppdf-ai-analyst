import { Schema, model, Document } from 'mongoose';

export interface NewsItemDoc extends Document {
  title: string;
  summary: string;
  url: string;
  sourceName?: string;
  publishedAt: Date;
  fetchedAt: Date;
  topicSlug: string;
  topicLabel: string;
  relatedProductIds?: string[];
  imageUrl?: string;
  agentRunId?: string;
  isActive: boolean;
}

const newsItemSchema = new Schema<NewsItemDoc>(
  {
    title: { type: String, required: true },
    summary: { type: String, default: '' },
    url: { type: String, required: true, unique: true },
    sourceName: { type: String },
    publishedAt: { type: Date, required: true, index: true },
    fetchedAt: { type: Date, required: true, default: () => new Date() },
    topicSlug: { type: String, required: true, index: true },
    topicLabel: { type: String, required: true },
    relatedProductIds: [{ type: String }],
    imageUrl: { type: String },
    agentRunId: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

newsItemSchema.index({ topicSlug: 1, publishedAt: -1 });

export const NewsItemModel = model<NewsItemDoc>('NewsItem', newsItemSchema);
